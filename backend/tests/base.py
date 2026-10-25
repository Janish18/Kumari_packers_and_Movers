from datetime import date, timedelta
from decimal import Decimal

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import CustomerProfile, DriverProfile, Role, User, Vehicle
from apps.catalog.models import BusinessConfiguration, PricingRule, ServiceArea, ServiceCategory

PW = "Str0ng!Passw0rd#1"


@override_settings(PAYMENT_PROVIDER="mock", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class Base(APITestCase):
    def setUp(self):
        cache.clear()
        self.service = ServiceCategory.objects.create(name="Local", slug="local", summary="s", description="d")
        for city in ("Chennai", "Bengaluru"):
            ServiceArea.objects.create(city=city, state="X")
        BusinessConfiguration.objects.create(key="gst_percent", value=18)
        BusinessConfiguration.objects.create(key="daily_capacity", value=2)
        PricingRule.objects.create(rule_type="PROPERTY_BASE", key="2BHK", label="2 BHK", amount=Decimal("8500"))
        PricingRule.objects.create(rule_type="PER_KM", key="default", label="km", amount=Decimal("20"))
        self.admin = User.objects.create_superuser("admin@x.com", PW, full_name="Admin")
        self.cust = self.mk_customer("c1@x.com", "9000000001")
        self.cust2 = self.mk_customer("c2@x.com", "9000000002")
        self.driver = self.mk_driver("d1@x.com", "9000000011", "DL1")
        self.driver2 = self.mk_driver("d2@x.com", "9000000012", "DL2")

    def mk_customer(self, email, phone):
        u = User.objects.create_user(email, PW, full_name="Cust " + email[:2], phone=phone)
        CustomerProfile.objects.create(user=u)
        return u

    def mk_driver(self, email, phone, lic, approved=True):
        u = User.objects.create_user(email, PW, full_name="Driver " + email[:2], phone=phone, role=Role.DRIVER)
        v = Vehicle.objects.create(registration_no="TN" + lic, category="MEDIUM", capacity_cft=300)
        return DriverProfile.objects.create(
            user=u, license_number=lic, license_expiry=date.today() + timedelta(days=400), vehicle=v,
            approval="APPROVED" if approved else "PENDING", availability="AVAILABLE" if approved else "OFF_DUTY")

    def as_user(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    def booking_payload(self, **kw):
        d = {"service": self.service.pk, "property_type": "2BHK", "move_date": str(date.today() + timedelta(days=10)),
             "pickup_line1": "1 A St", "pickup_city": "Chennai", "drop_line1": "2 B St", "drop_city": "Bengaluru",
             "distance_km": "350", "packing_required": True,
             "inventory": [{"name": "Sofa", "room": "Living Room", "quantity": 1}], "submit": True}
        d.update(kw)
        return d

    def make_booking(self, user=None, **kw):
        c = self.as_user(user or self.cust)
        r = c.post("/api/v1/customer/bookings/", self.booking_payload(**kw), format="json")
        assert r.status_code == 201, r.data
        return r.data["id"]

    def quote(self, bid):
        r = self.as_user(self.admin).post(f"/api/v1/admin/bookings/{bid}/quotations/", {"discount": "500", "valid_days": 5}, format="json")
        assert r.status_code == 200, r.data
        return r

    def to_confirmed(self, bid, user=None):
        self.quote(bid)
        assert self.as_user(user or self.cust).post(f"/api/v1/customer/bookings/{bid}/accept-quote/").status_code == 200
        r = self.as_user(self.admin).post(f"/api/v1/admin/bookings/{bid}/update-status/", {"status": "CONFIRMED"}, format="json")
        assert r.status_code == 200, r.data
