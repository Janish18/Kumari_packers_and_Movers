from .base import Base


class PermissionTests(Base):
    def test_anonymous_blocked(self):
        for url in ("/api/v1/customer/bookings/", "/api/v1/admin/dashboard/", "/api/v1/driver/jobs/", "/api/v1/notifications/"):
            self.assertEqual(self.client.get(url).status_code, 401, url)

    def test_role_walls(self):
        cust, drv, adm = self.as_user(self.cust), self.as_user(self.driver.user), self.as_user(self.admin)
        for url in ("/api/v1/admin/dashboard/", "/api/v1/admin/bookings/", "/api/v1/admin/customers/", "/api/v1/admin/payments/",
                    "/api/v1/admin/audit-logs/", "/api/v1/admin/pricing-rules/", "/api/v1/admin/reports/"):
            self.assertEqual(cust.get(url).status_code, 403, url)
            self.assertEqual(drv.get(url).status_code, 403, url)
            self.assertEqual(adm.get(url).status_code, 200, url)
        self.assertEqual(cust.get("/api/v1/driver/jobs/").status_code, 403)
        self.assertEqual(adm.get("/api/v1/driver/jobs/").status_code, 403)
        self.assertEqual(drv.get("/api/v1/customer/bookings/").status_code, 403)
        self.assertEqual(adm.get("/api/v1/customer/bookings/").status_code, 403)

    def test_customer_cannot_create_admin_or_driver_via_admin_api(self):
        r = self.as_user(self.cust).post("/api/v1/admin/drivers/", {}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_customer_isolation(self):
        bid = self.make_booking()
        other = self.as_user(self.cust2)
        self.assertEqual(other.get(f"/api/v1/customer/bookings/{bid}/").status_code, 404)
        self.assertEqual(other.get(f"/api/v1/customer/bookings/{bid}/tracking/").status_code, 404)
        self.assertEqual(other.post(f"/api/v1/customer/bookings/{bid}/cancel/", {"reason": "x"}, format="json").status_code, 404)
        self.assertEqual(other.post(f"/api/v1/customer/bookings/{bid}/accept-quote/").status_code, 404)
        self.assertEqual(other.patch(f"/api/v1/customer/bookings/{bid}/", {"special_instructions": "x"}, format="json").status_code, 404)
        self.assertEqual(other.get("/api/v1/customer/bookings/").data["count"], 0)

    def test_driver_sees_only_assigned_jobs(self):
        bid = self.make_booking()
        self.to_confirmed(bid)
        adm = self.as_user(self.admin)
        self.assertEqual(self.as_user(self.driver.user).get("/api/v1/driver/jobs/").data["count"], 0)
        adm.post(f"/api/v1/admin/bookings/{bid}/assign-driver/", {"driver": self.driver.pk}, format="json")
        self.assertEqual(self.as_user(self.driver.user).get("/api/v1/driver/jobs/").data["count"], 1)
        d2 = self.as_user(self.driver2.user)
        self.assertEqual(d2.get(f"/api/v1/driver/jobs/{bid}/").status_code, 404)
        self.assertEqual(d2.post(f"/api/v1/driver/jobs/{bid}/status/", {"status": "EN_ROUTE_TO_PICKUP"}, format="json").status_code, 404)

    def test_driver_response_hides_pricing_and_internal(self):
        bid = self.make_booking()
        self.to_confirmed(bid)
        self.as_user(self.admin).post(f"/api/v1/admin/bookings/{bid}/assign-driver/", {"driver": self.driver.pk}, format="json")
        data = self.as_user(self.driver.user).get(f"/api/v1/driver/jobs/{bid}/").data
        for k in ("internal_notes", "quotations", "payment_summary", "customer_info"):
            self.assertNotIn(k, data)
        self.assertEqual(data["customer_contact"]["name"], self.cust.full_name)

    def test_customer_never_sees_internal_notes(self):
        bid = self.make_booking()
        self.as_user(self.admin).patch(f"/api/v1/admin/bookings/{bid}/internal/", {"internal_notes": "secret"}, format="json")
        self.assertNotIn("internal_notes", self.as_user(self.cust).get(f"/api/v1/customer/bookings/{bid}/").data)

    def test_cannot_disable_admin_via_customer_endpoint(self):
        r = self.as_user(self.admin).patch(f"/api/v1/admin/customers/{self.admin.pk}/", {"is_active": False}, format="json")
        self.assertEqual(r.status_code, 404)
