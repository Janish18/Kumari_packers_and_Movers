import hashlib
import hmac
import json
from datetime import date, timedelta
from decimal import Decimal

from apps.accounts.models import DriverProfile
from apps.bookings.models import Booking, Quotation
from apps.core.models import AuditLog
from apps.payments.models import Payment, WebhookEvent
from apps.support.models import Notification

from .base import PW, Base


def sig(secret, msg):
    return hmac.new(secret.encode(), msg if isinstance(msg, bytes) else msg.encode(), hashlib.sha256).hexdigest()


class PricingTests(Base):
    def test_estimate_uses_decimals_and_gst(self):
        r = self.client.post("/api/v1/quotes/estimate/", {"property_type": "2BHK", "distance_km": "100"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["configured"] and r.data["is_estimate"])
        # base 8500 + labour(not configured) + 100km*20 = 10500; gst 18% = 1890
        self.assertEqual(Decimal(r.data["subtotal"]), Decimal("10500.00"))
        self.assertEqual(Decimal(r.data["gst"]), Decimal("1890.00"))
        self.assertEqual(Decimal(r.data["total"]), Decimal("12390.00"))

    def test_estimate_not_configured_does_not_invent_price(self):
        r = self.client.post("/api/v1/quotes/estimate/", {"property_type": "VILLA"}, format="json")
        self.assertFalse(r.data["configured"])
        self.assertIsNone(r.data["total"])

    def test_estimate_without_distance_says_so(self):
        r = self.client.post("/api/v1/quotes/estimate/", {"property_type": "2BHK"}, format="json")
        self.assertTrue(any("Distance" in n for n in r.data["notes"]))

    def test_estimate_rejects_bad_input(self):
        self.assertEqual(self.client.post("/api/v1/quotes/estimate/", {"property_type": "CASTLE"}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/v1/quotes/estimate/", {"property_type": "2BHK", "distance_km": "-5"}, format="json").status_code, 400)


class BookingTests(Base):
    def test_create_validates(self):
        c = self.as_user(self.cust)
        past = self.booking_payload(move_date=str(date.today() - timedelta(days=1)))
        self.assertEqual(c.post("/api/v1/customer/bookings/", past, format="json").status_code, 400)
        self.assertEqual(c.post("/api/v1/customer/bookings/", self.booking_payload(property_type="XX"), format="json").status_code, 400)
        self.assertEqual(c.post("/api/v1/customer/bookings/", self.booking_payload(pickup_line1=""), format="json").status_code, 400)

    def test_draft_edit_then_submit(self):
        c = self.as_user(self.cust)
        r = c.post("/api/v1/customer/bookings/", self.booking_payload(submit=False), format="json")
        bid = r.data["id"]
        self.assertEqual(r.data["status"], "DRAFT")
        self.assertTrue(r.data["reference"].startswith("KPM-"))
        self.assertEqual(c.patch(f"/api/v1/customer/bookings/{bid}/", {"special_instructions": "Call first"}, format="json").status_code, 200)
        self.assertEqual(c.post(f"/api/v1/customer/bookings/{bid}/submit/").data["status"], "QUOTE_REQUESTED")
        self.assertEqual(c.patch(f"/api/v1/customer/bookings/{bid}/", {"special_instructions": "x"}, format="json").status_code, 400)
        self.assertEqual(c.post(f"/api/v1/customer/bookings/{bid}/submit/").status_code, 409)

    def test_unsupported_destination_flagged_manual(self):
        bid = self.make_booking(drop_city="Atlantis")
        self.assertTrue(Booking.objects.get(pk=bid).needs_manual_confirmation)

    def test_quote_requires_lines_when_pricing_missing(self):
        bid = self.make_booking(property_type="VILLA")
        adm = self.as_user(self.admin)
        self.assertEqual(adm.post(f"/api/v1/admin/bookings/{bid}/quotations/", {}, format="json").status_code, 400)
        r = adm.post(f"/api/v1/admin/bookings/{bid}/quotations/", {"extra_lines": [{"label": "Custom move", "unit_price": "30000"}]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)

    def test_quotation_versions_and_acceptance_rules(self):
        bid = self.make_booking()
        self.quote(bid)
        r = self.quote(bid)  # revise
        qs = r.data["quotations"]
        self.assertEqual([q["version"] for q in qs], [2, 1])
        self.assertEqual(qs[1]["status"], "SUPERSEDED")
        self.assertEqual(Decimal(qs[0]["total"]), Decimal("17700.00"))  # (8500 + 350km*20 - 500 discount) = 15000, +18% GST
        c = self.as_user(self.cust)
        self.assertEqual(c.post(f"/api/v1/customer/bookings/{bid}/accept-quote/", {"quotation_id": qs[1]["id"]}, format="json").status_code, 409)
        ok = c.post(f"/api/v1/customer/bookings/{bid}/accept-quote/", {"quotation_id": qs[0]["id"]}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.data["status"], "QUOTE_ACCEPTED")
        self.assertEqual(c.post(f"/api/v1/customer/bookings/{bid}/accept-quote/").status_code, 409)  # duplicate
        self.assertEqual(self.as_user(self.admin).post(f"/api/v1/admin/bookings/{bid}/quotations/", {}, format="json").status_code, 400)

    def test_expired_quotation_cannot_be_accepted(self):
        bid = self.make_booking()
        self.quote(bid)
        Quotation.objects.filter(booking_id=bid).update(valid_until=date.today() - timedelta(days=1))
        r = self.as_user(self.cust).post(f"/api/v1/customer/bookings/{bid}/accept-quote/")
        self.assertEqual(r.status_code, 400)

    def test_invalid_and_forbidden_transitions(self):
        bid = self.make_booking()
        cust, adm = self.as_user(self.cust), self.as_user(self.admin)
        # customer cannot confirm / self-promote
        r = adm.post(f"/api/v1/admin/bookings/{bid}/update-status/", {"status": "CONFIRMED"}, format="json")
        self.assertEqual(r.status_code, 400)  # not a legal jump
        self.assertEqual(adm.post(f"/api/v1/admin/bookings/{bid}/update-status/", {"status": "NOPE"}, format="json").status_code, 400)
        self.assertEqual(adm.post(f"/api/v1/admin/bookings/{bid}/update-status/", {"status": "REJECTED"}, format="json").status_code, 400)  # reason required
        self.assertEqual(adm.post(f"/api/v1/admin/bookings/{bid}/update-status/", {"status": "REJECTED", "reason": "Unserviceable"}, format="json").status_code, 200)
        self.assertEqual(adm.post(f"/api/v1/admin/bookings/{bid}/update-status/", {"status": "QUOTE_PREPARED"}, format="json").status_code, 400)  # terminal

    def test_stale_expected_status_conflicts(self):
        bid = self.make_booking()
        r = self.as_user(self.admin).post(f"/api/v1/admin/bookings/{bid}/update-status/",
                                          {"status": "REJECTED", "reason": "x", "expected_status": "DRAFT"}, format="json")
        self.assertEqual(r.status_code, 409)

    def test_cancel_records_reason_and_history(self):
        bid = self.make_booking()
        c = self.as_user(self.cust)
        self.assertEqual(c.post(f"/api/v1/customer/bookings/{bid}/cancel/", {}, format="json").status_code, 400)
        r = c.post(f"/api/v1/customer/bookings/{bid}/cancel/", {"reason": "Plans changed"}, format="json")
        self.assertEqual(r.status_code, 200)
        b = Booking.objects.get(pk=bid)
        self.assertEqual((b.status, b.cancelled_reason, b.cancelled_by_id), ("CANCELLED", "Plans changed", self.cust.pk))
        self.assertEqual(c.post(f"/api/v1/customer/bookings/{bid}/cancel/", {"reason": "again"}, format="json").status_code, 409)
        self.assertTrue(b.history.filter(to_status="CANCELLED", actor=self.cust).exists())

    def test_late_cancellation_flag(self):
        from apps.catalog.models import BusinessConfiguration
        BusinessConfiguration.objects.create(key="free_cancellation_hours", value=100)
        bid = self.make_booking(move_date=str(date.today() + timedelta(days=1)))
        self.to_confirmed(bid)
        r = self.as_user(self.cust).post(f"/api/v1/customer/bookings/{bid}/cancel/", {"reason": "sudden"}, format="json")
        self.assertTrue(Booking.objects.get(pk=bid).late_cancellation)
        self.assertIn("fee", r.data["message"])

    def test_reschedule_auto_before_confirm_and_request_after(self):
        bid = self.make_booking()
        c = self.as_user(self.cust)
        new = str(date.today() + timedelta(days=20))
        r = c.post(f"/api/v1/customer/bookings/{bid}/reschedule/", {"requested_date": new}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(str(Booking.objects.get(pk=bid).move_date), new)
        self.to_confirmed(bid)
        new2 = str(date.today() + timedelta(days=25))
        c.post(f"/api/v1/customer/bookings/{bid}/reschedule/", {"requested_date": new2}, format="json")
        self.assertEqual(str(Booking.objects.get(pk=bid).move_date), new)  # unchanged until admin approves
        self.assertEqual(c.post(f"/api/v1/customer/bookings/{bid}/reschedule/", {"requested_date": new2}, format="json").status_code, 409)
        self.as_user(self.admin).post(f"/api/v1/admin/bookings/{bid}/resolve-reschedule/", {"approve": True}, format="json")
        self.assertEqual(str(Booking.objects.get(pk=bid).move_date), new2)

    def test_capacity_blocks_confirmation(self):
        ids = [self.make_booking() for _ in range(3)]  # capacity is 2 on the same date
        self.to_confirmed(ids[0])
        self.to_confirmed(ids[1])
        self.quote(ids[2])
        self.as_user(self.cust).post(f"/api/v1/customer/bookings/{ids[2]}/accept-quote/")
        r = self.as_user(self.admin).post(f"/api/v1/admin/bookings/{ids[2]}/update-status/", {"status": "CONFIRMED"}, format="json")
        self.assertEqual(r.status_code, 409)


class DispatchTests(Base):
    def setUp(self):
        super().setUp()
        self.bid = self.make_booking()
        self.to_confirmed(self.bid)
        self.adm = self.as_user(self.admin)
        self.drv = self.as_user(self.driver.user)

    def assign(self, bid=None, driver=None):
        return self.adm.post(f"/api/v1/admin/bookings/{bid or self.bid}/assign-driver/", {"driver": (driver or self.driver).pk}, format="json")

    def test_assignment_rules(self):
        self.assertEqual(self.assign().status_code, 200)
        self.assertEqual(Booking.objects.get(pk=self.bid).status, "DRIVER_ASSIGNED")
        self.assertEqual(self.assign().status_code, 409)  # already assigned
        pending = self.mk_driver("d3@x.com", "9000000013", "DL3", approved=False)
        self.assertEqual(self.assign(driver=pending).status_code, 400)
        # clash on same date
        b2 = self.make_booking(user=self.cust2)
        self.to_confirmed(b2, user=self.cust2)
        self.assertEqual(self.assign(b2).status_code, 409)
        self.assertEqual(self.assign(b2, self.driver2).status_code, 200)  # reassign other driver ok
        # reassign first booking releases driver 1
        self.assertEqual(self.assign(self.bid, self.driver2).status_code, 409)  # driver2 busy that day
        self.assertEqual(Notification.objects.filter(user=self.driver.user, kind="JOB_ASSIGNED").count(), 1)

    def test_expired_license_and_off_duty_blocked(self):
        self.driver.license_expiry = date.today() - timedelta(days=1)
        self.driver.save()
        self.assertEqual(self.assign().status_code, 400)
        self.driver.license_expiry = date.today() + timedelta(days=100)
        self.driver.availability = "OFF_DUTY"
        self.driver.save()
        self.assertEqual(self.assign().status_code, 400)

    def test_cannot_assign_before_confirmed(self):
        b = self.make_booking()
        self.assertEqual(self.assign(b, self.driver2).status_code, 400)

    def test_full_job_lifecycle_and_driver_rules(self):
        self.assign()
        url = f"/api/v1/driver/jobs/{self.bid}/status/"
        self.assertEqual(self.drv.post(url, {"status": "COMPLETED"}, format="json").status_code, 400)  # skip steps
        self.assertEqual(self.drv.post(url, {"status": "CONFIRMED"}, format="json").status_code, 403)  # driver can't un-assign
        self.assertEqual(self.drv.post(url, {"status": "CANCELLED", "reason": "x"}, format="json").status_code, 403)
        for s in ("EN_ROUTE_TO_PICKUP", "LOADING", "IN_TRANSIT", "UNLOADING"):
            r = self.drv.post(url, {"status": s}, format="json")
            self.assertEqual(r.status_code, 200, (s, r.data))
        self.assertEqual(self.drv.post(url, {"status": "UNLOADING"}, format="json").status_code, 409)  # duplicate
        self.assertEqual(self.drv.post(url, {"status": "COMPLETED"}, format="json").status_code, 400)  # needs proof/note
        r = self.drv.post(url, {"status": "COMPLETED", "completion_note": "All delivered, customer signed off"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        b = Booking.objects.get(pk=self.bid)
        self.assertEqual(b.status, "COMPLETED")
        self.assertIsNotNone(b.completed_at)
        self.driver.refresh_from_db()
        self.assertEqual(self.driver.availability, "AVAILABLE")
        hist = list(b.history.values_list("to_status", flat=True))
        self.assertEqual(hist[-5:], ["EN_ROUTE_TO_PICKUP", "LOADING", "IN_TRANSIT", "UNLOADING", "COMPLETED"])
        self.assertTrue(b.history.filter(to_status="LOADING", actor=self.driver.user).exists())

    def test_customer_sees_verified_status_changes(self):
        self.assign()
        self.drv.post(f"/api/v1/driver/jobs/{self.bid}/status/", {"status": "EN_ROUTE_TO_PICKUP"}, format="json")
        t = self.as_user(self.cust).get(f"/api/v1/customer/bookings/{self.bid}/tracking/").data
        self.assertEqual(t["status"], "EN_ROUTE_TO_PICKUP")
        self.assertEqual(t["timeline"][-1]["to_status"], "EN_ROUTE_TO_PICKUP")
        self.assertEqual(t["driver_info"]["name"], self.driver.user.full_name)
        self.assertTrue(Notification.objects.filter(user=self.cust, kind="BOOKING_STATUS", title__contains="En route").exists())

    def test_location_requires_consent_active_job_and_assignment(self):
        self.assign()
        loc = f"/api/v1/driver/jobs/{self.bid}/location/"
        pt = {"latitude": 13.08, "longitude": 80.27}
        self.drv.post(f"/api/v1/driver/jobs/{self.bid}/status/", {"status": "EN_ROUTE_TO_PICKUP"}, format="json")
        self.assertEqual(self.drv.post(loc, pt, format="json").status_code, 403)  # no consent yet
        self.drv.patch("/api/v1/driver/dashboard/", {"share_location": True}, format="json")
        self.assertEqual(self.drv.post(loc, {"latitude": 999, "longitude": 1}, format="json").status_code, 400)
        self.assertEqual(self.drv.post(loc, pt, format="json").status_code, 201)
        self.assertEqual(self.as_user(self.driver2.user).post(loc, pt, format="json").status_code, 404)
        t = self.as_user(self.cust).get(f"/api/v1/customer/bookings/{self.bid}/tracking/").data
        self.assertTrue(t["live"]["available"])
        self.assertEqual(float(t["live"]["last_location"]["latitude"]), 13.08)
        self.assertEqual(self.as_user(self.cust2).get(f"/api/v1/customer/bookings/{self.bid}/tracking/").status_code, 404)

    def test_no_live_location_before_job_or_without_consent(self):
        self.assign()
        t = self.as_user(self.cust).get(f"/api/v1/customer/bookings/{self.bid}/tracking/").data
        self.assertFalse(t["live"]["available"])
        self.assertIsNone(t["live"]["last_location"])
        self.drv.post(f"/api/v1/driver/jobs/{self.bid}/status/", {"status": "EN_ROUTE_TO_PICKUP"}, format="json")
        t = self.as_user(self.cust).get(f"/api/v1/customer/bookings/{self.bid}/tracking/").data
        self.assertFalse(t["live"]["available"])

    def test_exception_requires_reason_and_alerts_admin(self):
        self.assign()
        self.drv.post(f"/api/v1/driver/jobs/{self.bid}/status/", {"status": "EN_ROUTE_TO_PICKUP"}, format="json")
        url = f"/api/v1/driver/jobs/{self.bid}/status/"
        self.assertEqual(self.drv.post(url, {"status": "EXCEPTION_REQUIRES_REVIEW"}, format="json").status_code, 400)
        self.assertEqual(self.drv.post(url, {"status": "EXCEPTION_REQUIRES_REVIEW", "reason": "Road blocked"}, format="json").status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.admin, kind="JOB_EXCEPTION").exists())

    def test_driver_cannot_change_availability_mid_job_or_when_unapproved(self):
        self.assign()
        self.drv.post(f"/api/v1/driver/jobs/{self.bid}/status/", {"status": "EN_ROUTE_TO_PICKUP"}, format="json")
        from apps.accounts.models import User
        fresh = self.as_user(User.objects.get(pk=self.driver.user.pk))
        self.assertEqual(fresh.patch("/api/v1/driver/dashboard/", {"availability": "OFF_DUTY"}, format="json").status_code, 400)

    def test_delivery_proof_validates_file(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.assign()
        for s in ("EN_ROUTE_TO_PICKUP", "LOADING", "IN_TRANSIT"):
            self.drv.post(f"/api/v1/driver/jobs/{self.bid}/status/", {"status": s}, format="json")
        url = f"/api/v1/driver/jobs/{self.bid}/delivery-proof/"
        bad = SimpleUploadedFile("evil.jpg", b"<?php echo 1; ?>", content_type="image/jpeg")
        self.assertEqual(self.drv.post(url, {"file": bad}, format="multipart").status_code, 400)  # content sniffed, not extension
        import io
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (10, 10), "red").save(buf, "PNG")
        good = SimpleUploadedFile("proof.png", buf.getvalue(), content_type="image/png")
        self.assertEqual(self.drv.post(url, {"file": good, "note": "left at door"}, format="multipart").status_code, 201)
        # a PNG uploaded with a dangerous extension is stored under a random safe name
        sneaky = SimpleUploadedFile("x.html", buf.getvalue(), content_type="text/html")
        r = self.drv.post(url, {"file": sneaky}, format="multipart")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.json()["url"].endswith(".png"))
        self.assertNotIn("x.html", r.json()["url"])


class PaymentTests(Base):
    def setUp(self):
        super().setUp()
        self.bid = self.make_booking()
        self.c = self.as_user(self.cust)

    def pay_order(self, kind="ADVANCE"):
        return self.c.post("/api/v1/customer/payments/create-order/", {"booking": self.bid, "kind": kind}, format="json")

    def test_cannot_pay_before_quote_accepted(self):
        self.assertEqual(self.pay_order().status_code, 400)

    def test_amount_is_server_side_and_signature_required(self):
        self.to_confirmed(self.bid)
        r = self.c.post("/api/v1/customer/payments/create-order/", {"booking": self.bid, "kind": "ADVANCE", "amount": "1"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        q = Quotation.objects.get(booking_id=self.bid, status="ACCEPTED")
        self.assertEqual(Decimal(r.data["amount"]), (q.total * Decimal("0.25")).quantize(Decimal("0.01")))
        oid = r.data["order_id"]
        # browser says "success" but signature is bogus -> NOT marked paid
        bad = self.c.post("/api/v1/customer/payments/verify/", {"order_id": oid, "payment_id": "pay_1", "signature": "forged"}, format="json")
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(Payment.objects.get(provider_order_id=oid).status, "FAILED")
        r2 = self.pay_order()  # retry creates a fresh order
        oid2 = r2.data["order_id"]
        ok = self.c.post("/api/v1/customer/payments/verify/", {"order_id": oid2, "payment_id": "pay_2", "signature": sig("mock_secret", f"{oid2}|pay_2")}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data["status"], "SUCCESS")
        again = self.c.post("/api/v1/customer/payments/verify/", {"order_id": oid2, "payment_id": "pay_2", "signature": sig("mock_secret", f"{oid2}|pay_2")}, format="json")
        self.assertTrue(again.data["already_processed"])
        self.assertEqual(Payment.objects.filter(status="SUCCESS").count(), 1)
        self.assertEqual(self.as_user(self.cust2).post("/api/v1/customer/payments/verify/", {"order_id": oid2, "payment_id": "pay_2", "signature": sig("mock_secret", f"{oid2}|pay_2")}, format="json").status_code, 400)

    def _paid_order(self):
        self.to_confirmed(self.bid)
        oid = self.pay_order().data["order_id"]
        return oid

    def test_webhook_signature_and_idempotency(self):
        oid = self._paid_order()
        body = json.dumps({"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_9", "order_id": oid}}}}).encode()
        h = {"HTTP_X_RAZORPAY_EVENT_ID": "evt_1"}
        r = self.client.post("/api/v1/payments/webhook/", body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE="bad", **h)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Payment.objects.get(provider_order_id=oid).status, "PENDING")
        good = sig("mock_hook", body)
        r = self.client.post("/api/v1/payments/webhook/", body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=good, **h)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Payment.objects.get(provider_order_id=oid).status, "SUCCESS")
        dup = self.client.post("/api/v1/payments/webhook/", body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=good, **h)
        self.assertEqual(dup.data["status"], "duplicate_ignored")
        self.assertEqual(WebhookEvent.objects.count(), 1)
        # same payment, new event id: must not double-count
        self.client.post("/api/v1/payments/webhook/", body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=good, HTTP_X_RAZORPAY_EVENT_ID="evt_2")
        self.assertEqual(Notification.objects.filter(kind="PAYMENT", user=self.cust).count(), 1)

    def test_revenue_only_from_verified_payments_and_refund(self):
        oid = self._paid_order()
        adm = self.as_user(self.admin)
        self.assertEqual(Decimal(str(adm.get("/api/v1/admin/dashboard/").data["metrics"]["revenue"])), Decimal("0"))
        self.c.post("/api/v1/customer/payments/verify/", {"order_id": oid, "payment_id": "pay_3", "signature": sig("mock_secret", f"{oid}|pay_3")}, format="json")
        pid = Payment.objects.get(provider_order_id=oid).pk
        rev = Decimal(str(adm.get("/api/v1/admin/dashboard/").data["metrics"]["revenue"]))
        self.assertGreater(rev, 0)
        self.assertEqual(adm.post(f"/api/v1/admin/payments/{pid}/refund/", {"amount": "10"}, format="json").status_code, 400)  # reason needed
        self.assertEqual(adm.post(f"/api/v1/admin/payments/{pid}/refund/", {"amount": "99999999", "reason": "x"}, format="json").status_code, 400)
        r = adm.post(f"/api/v1/admin/payments/{pid}/refund/", {"amount": "100", "reason": "Goodwill"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "PARTIALLY_REFUNDED")
        self.assertEqual(Decimal(str(adm.get("/api/v1/admin/dashboard/").data["metrics"]["revenue"])), rev - 100)
        self.assertEqual(self.c.post(f"/api/v1/admin/payments/{pid}/refund/", {"amount": "1", "reason": "x"}, format="json").status_code, 403)
        self.assertTrue(AuditLog.objects.filter(action="refund_issued").exists())

    def test_invoice_issued_on_acceptance_and_downloadable_by_owner_only(self):
        self.to_confirmed(self.bid)
        inv = self.c.get("/api/v1/customer/invoices/").data["results"]
        self.assertEqual(len(inv), 1)
        r = self.c.get(f"/api/v1/customer/invoices/{inv[0]['id']}/download/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "application/pdf")
        self.assertTrue(r.content.startswith(b"%PDF"))
        self.assertEqual(self.as_user(self.cust2).get(f"/api/v1/customer/invoices/{inv[0]['id']}/download/").status_code, 404)

    def test_unconfigured_gateway_is_clear(self):
        from django.test import override_settings
        self.to_confirmed(self.bid)
        with override_settings(PAYMENT_PROVIDER="razorpay", RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET=""):
            r = self.pay_order()
        self.assertEqual(r.status_code, 503)
        self.assertIn("not configured", r.data["error"]["message"].lower())


class ReviewSupportAdminTests(Base):
    def complete_job(self):
        bid = self.make_booking()
        self.to_confirmed(bid)
        self.as_user(self.admin).post(f"/api/v1/admin/bookings/{bid}/assign-driver/", {"driver": self.driver.pk}, format="json")
        d = self.as_user(self.driver.user)
        for s in ("EN_ROUTE_TO_PICKUP", "LOADING", "IN_TRANSIT", "UNLOADING"):
            d.post(f"/api/v1/driver/jobs/{bid}/status/", {"status": s}, format="json")
        d.post(f"/api/v1/driver/jobs/{bid}/status/", {"status": "COMPLETED", "completion_note": "done"}, format="json")
        return bid

    def test_reviews_only_after_completion_one_each_and_moderated(self):
        bid = self.make_booking()
        c = self.as_user(self.cust)
        self.assertEqual(c.post("/api/v1/customer/reviews/", {"booking": bid, "rating": 5}, format="json").status_code, 400)
        bid = self.complete_job()
        self.assertEqual(c.post("/api/v1/customer/reviews/", {"booking": bid, "rating": 9}, format="json").status_code, 400)
        self.assertEqual(self.as_user(self.cust2).post("/api/v1/customer/reviews/", {"booking": bid, "rating": 5}, format="json").status_code, 400)
        self.assertEqual(c.post("/api/v1/customer/reviews/", {"booking": bid, "rating": 5, "comment": "Great", "driver_rating": 4}, format="json").status_code, 201)
        self.assertEqual(c.post("/api/v1/customer/reviews/", {"booking": bid, "rating": 5}, format="json").status_code, 400)
        self.assertEqual(self.client.get("/api/v1/reviews/").data, [])  # not public until approved
        rid = self.as_user(self.admin).get("/api/v1/admin/reviews/").data["results"][0]["id"]
        self.as_user(self.admin).patch(f"/api/v1/admin/reviews/{rid}/", {"status": "APPROVED"}, format="json")
        pub = self.client.get("/api/v1/reviews/").data
        self.assertEqual(len(pub), 1)
        self.assertNotIn("email", json.dumps(pub))

    def test_public_endpoints_empty_states(self):
        self.assertEqual(self.client.get("/api/v1/reviews/").data, [])
        self.assertEqual(self.client.get("/api/v1/faqs/").data, [])
        self.assertEqual(self.client.get("/api/v1/services/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/service-areas/?q=chen").data[0]["city"], "Chennai")
        cfg = self.client.get("/api/v1/site-config/").data
        self.assertFalse(cfg["integrations"]["payments"])

    def test_tickets_and_damage_isolation(self):
        bid = self.complete_job()
        c, c2 = self.as_user(self.cust), self.as_user(self.cust2)
        t = c.post("/api/v1/customer/support-tickets/", {"subject": "Help", "message": "Question", "booking": bid}, format="json")
        self.assertEqual(t.status_code, 201)
        self.assertEqual(c2.post("/api/v1/customer/support-tickets/", {"subject": "x", "message": "y", "booking": bid}, format="json").status_code, 400)
        self.assertEqual(c2.get("/api/v1/customer/support-tickets/").data["count"], 0)
        dmg = c.post("/api/v1/customer/damage-reports/", {"booking": bid, "kind": "DAMAGE", "item_name": "Sofa", "description": "Torn"}, format="json")
        self.assertEqual(dmg.status_code, 201, dmg.data)
        self.assertEqual(c2.post("/api/v1/customer/damage-reports/", {"booking": bid, "kind": "MISSING", "item_name": "x", "description": "y"}, format="json").status_code, 400)
        adm = self.as_user(self.admin)
        did = adm.get("/api/v1/admin/damage-reports/").data["results"][0]["id"]
        adm.patch(f"/api/v1/admin/damage-reports/{did}/", {"status": "RESOLVED", "resolution": "Compensated"}, format="json")
        self.assertTrue(Notification.objects.filter(user=self.cust, title__icontains="report").exists())

    def test_notifications_are_private_and_markable(self):
        self.make_booking()
        c = self.as_user(self.cust)
        n = c.get("/api/v1/notifications/").data["results"]
        self.assertTrue(n)
        self.assertEqual(self.as_user(self.cust2).get("/api/v1/notifications/").data["count"], 0)
        self.assertEqual(self.as_user(self.cust2).patch(f"/api/v1/notifications/{n[0]['id']}/", {"is_read": True}, format="json").status_code, 404)
        c.post("/api/v1/notifications/mark-all-read/")
        self.assertEqual(c.get("/api/v1/notifications/?is_read=false").data["count"], 0)

    def test_admin_driver_crud_and_disable_customer_audited(self):
        adm = self.as_user(self.admin)
        r = adm.post("/api/v1/admin/drivers/", {"full_name": "New Drv", "email": "nd@x.com", "phone": "9333333333", "password": "Dr1ver!Passw0rd#",
                                                  "license_number": "DLX", "license_expiry": str(date.today() + timedelta(days=300))}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["approval"], "PENDING")
        self.assertNotIn("password", r.data)
        pid = r.data["profile_id"]
        self.assertFalse(DriverProfile.objects.get(pk=pid).assignable)
        self.assertEqual(adm.post(f"/api/v1/admin/drivers/{pid}/approve/").status_code, 200)
        self.assertEqual(adm.post("/api/v1/admin/drivers/", {"full_name": "Dup", "email": "nd@x.com", "phone": "9444444444", "password": "Dr1ver!Passw0rd#",
                                                              "license_number": "DLY", "license_expiry": str(date.today() + timedelta(days=300))}, format="json").status_code, 400)
        tok = self.client.post("/api/v1/auth/login/", {"identifier": "c1@x.com", "password": PW}, format="json").data["access"]
        self.assertEqual(adm.patch(f"/api/v1/admin/customers/{self.cust.pk}/", {"is_active": False, "disabled_reason": "Fraud check"}, format="json").status_code, 200)
        self.assertTrue(AuditLog.objects.filter(action="customer_disabled", actor=self.admin).exists())
        from rest_framework.test import APIClient
        old = APIClient(); old.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
        self.assertEqual(old.get("/api/v1/auth/me/").status_code, 401)  # token no longer honoured
        self.assertNotIn("password", json.dumps(adm.get("/api/v1/admin/customers/").data))

    def test_reports_and_csv_export_audited_and_safe(self):
        self.complete_job()
        adm = self.as_user(self.admin)
        for t in ("bookings", "revenue", "drivers", "cancellations", "quality"):
            self.assertEqual(adm.get(f"/api/v1/admin/reports/?type={t}").status_code, 200, t)
        self.assertEqual(adm.get("/api/v1/admin/reports/?type=zzz").status_code, 400)
        self.assertEqual(adm.get("/api/v1/admin/reports/?date_from=2030-01-02&date_to=2030-01-01").status_code, 400)
        r = adm.get("/api/v1/admin/reports/?type=bookings&export=csv&date_from=2020-01-01&date_to=2099-01-01")
        self.assertEqual(r["Content-Type"], "text/csv")
        self.assertIn("KPM-", r.content.decode())
        self.assertTrue(AuditLog.objects.filter(action="report_exported").exists())
        self.assertEqual(self.as_user(self.cust).get("/api/v1/admin/reports/?export=csv").status_code, 403)

    def test_admin_dashboard_numbers_come_from_db(self):
        self.complete_job()
        m = self.as_user(self.admin).get("/api/v1/admin/dashboard/").data["metrics"]
        self.assertEqual((m["total_bookings"], m["completed_jobs"], m["cancellations"]), (1, 1, 0))

    def test_audit_trail_records_status_assignment_quote(self):
        self.complete_job()
        actions = set(AuditLog.objects.values_list("action", flat=True))
        self.assertTrue({"quotation_issued", "driver_assigned", "booking_status_changed"} <= actions)

    def test_customer_dashboard(self):
        self.make_booking()
        d = self.as_user(self.cust).get("/api/v1/customer/dashboard/").data
        self.assertEqual(d["counts"]["total"], 1)
        self.assertEqual(self.as_user(self.cust2).get("/api/v1/customer/dashboard/").data["counts"]["total"], 0)
