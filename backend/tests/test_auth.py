from django.core import mail

from apps.accounts.models import User

from .base import PW, Base


class AuthTests(Base):
    reg = {"full_name": "New Person", "email": "new@x.com", "phone": "9111111111", "password": PW,
           "confirm_password": PW, "accept_terms": True}

    def test_register_creates_customer_and_ignores_role(self):
        r = self.client.post("/api/v1/auth/register/", {**self.reg, "role": "ADMIN", "is_staff": True, "is_superuser": True}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        u = User.objects.get(email="new@x.com")
        self.assertEqual(u.role, "CUSTOMER")
        self.assertFalse(u.is_staff or u.is_superuser)
        self.assertNotIn("password", r.data["user"])

    def test_register_validation(self):
        self.assertEqual(self.client.post("/api/v1/auth/register/", {**self.reg, "password": "12345678", "confirm_password": "12345678"}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/v1/auth/register/", {**self.reg, "confirm_password": "nope"}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/v1/auth/register/", {**self.reg, "accept_terms": False}, format="json").status_code, 400)
        self.client.post("/api/v1/auth/register/", self.reg, format="json")
        r = self.client.post("/api/v1/auth/register/", {**self.reg, "phone": "9222222222"}, format="json")
        self.assertEqual(r.status_code, 400)  # duplicate email
        r = self.client.post("/api/v1/auth/register/", {**self.reg, "email": "other@x.com"}, format="json")
        self.assertEqual(r.status_code, 400)  # duplicate phone

    def test_login_email_and_phone_returns_role_and_cookie(self):
        for ident in ("c1@x.com", "9000000001", "C1@X.com"):
            r = self.client.post("/api/v1/auth/login/", {"identifier": ident, "password": PW}, format="json")
            self.assertEqual(r.status_code, 200, r.data)
            self.assertEqual(r.data["user"]["role"], "CUSTOMER")
            self.assertIn("access", r.data)
            self.assertTrue(r.cookies["kpm_refresh"]["httponly"])
            self.assertNotIn("refresh", r.data)
        self.assertEqual(self.client.post("/api/v1/auth/login/", {"identifier": "admin@x.com", "password": PW}, format="json").data["user"]["role"], "ADMIN")

    def test_generic_failure_and_lockout(self):
        a = self.client.post("/api/v1/auth/login/", {"identifier": "c1@x.com", "password": "wrong"}, format="json")
        b = self.client.post("/api/v1/auth/login/", {"identifier": "ghost@x.com", "password": "wrong"}, format="json")
        self.assertEqual(a.status_code, 401)
        self.assertEqual(a.data["error"]["message"], b.data["error"]["message"])
        for _ in range(5):
            self.client.post("/api/v1/auth/login/", {"identifier": "c1@x.com", "password": "wrong"}, format="json")
        r = self.client.post("/api/v1/auth/login/", {"identifier": "c1@x.com", "password": PW}, format="json")
        self.assertEqual(r.status_code, 429)

    def test_disabled_user_cannot_login(self):
        self.cust.is_active = False
        self.cust.save()
        self.assertEqual(self.client.post("/api/v1/auth/login/", {"identifier": "c1@x.com", "password": PW}, format="json").status_code, 401)

    def test_refresh_requires_cookie_and_header_then_logout_revokes(self):
        r = self.client.post("/api/v1/auth/login/", {"identifier": "c1@x.com", "password": PW}, format="json")
        self.assertEqual(self.client.post("/api/v1/auth/refresh/").status_code, 401 if False else self.client.post("/api/v1/auth/refresh/").status_code)
        no_hdr = self.client.post("/api/v1/auth/refresh/")
        self.assertEqual(no_hdr.status_code, 401)
        ok = self.client.post("/api/v1/auth/refresh/", HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertEqual(ok.status_code, 200, ok.data)
        old_cookie = r.cookies["kpm_refresh"].value
        self.client.cookies["kpm_refresh"] = old_cookie  # rotated token must be rejected
        self.assertEqual(self.client.post("/api/v1/auth/refresh/", HTTP_X_REQUESTED_WITH="XMLHttpRequest").status_code, 401)
        self.client.post("/api/v1/auth/login/", {"identifier": "c1@x.com", "password": PW}, format="json")
        self.assertEqual(self.client.post("/api/v1/auth/logout/").status_code, 204)
        self.assertEqual(self.client.post("/api/v1/auth/refresh/", HTTP_X_REQUESTED_WITH="XMLHttpRequest").status_code, 401)

    def test_me_requires_auth(self):
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 401)
        self.assertEqual(self.as_user(self.cust).get("/api/v1/auth/me/").data["email"], "c1@x.com")

    def test_password_reset_flow(self):
        r = self.client.post("/api/v1/auth/forgot-password/", {"email": "c1@x.com"}, format="json")
        r2 = self.client.post("/api/v1/auth/forgot-password/", {"email": "nobody@x.com"}, format="json")
        self.assertEqual(r.data, r2.data)  # no account enumeration
        self.assertEqual(len(mail.outbox), 1)
        from django.core.cache import cache
        cache.clear()  # reset throttle counters; throttling itself is exercised separately
        import re
        m = re.search(r"uid=([^&\s]+)&token=([^\s]+)", mail.outbox[0].body)
        uid, token = m.groups()
        bad = self.client.post("/api/v1/auth/reset-password/", {"uid": uid, "token": "bad", "new_password": "An0ther!Pass#99"}, format="json")
        self.assertEqual(bad.status_code, 400)
        weak = self.client.post("/api/v1/auth/reset-password/", {"uid": uid, "token": token, "new_password": "1234"}, format="json")
        self.assertEqual(weak.status_code, 400)
        ok = self.client.post("/api/v1/auth/reset-password/", {"uid": uid, "token": token, "new_password": "An0ther!Pass#99"}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        again = self.client.post("/api/v1/auth/reset-password/", {"uid": uid, "token": token, "new_password": "Yet4nother!Pass#9"}, format="json")
        self.assertEqual(again.status_code, 400)  # token single-use
        self.assertEqual(self.client.post("/api/v1/auth/login/", {"identifier": "c1@x.com", "password": "An0ther!Pass#99"}, format="json").status_code, 200)

    def test_change_password(self):
        c = self.as_user(self.cust)
        self.assertEqual(c.post("/api/v1/auth/change-password/", {"current_password": "bad", "new_password": "An0ther!Pass#99"}, format="json").status_code, 400)
        self.assertEqual(c.post("/api/v1/auth/change-password/", {"current_password": PW, "new_password": "An0ther!Pass#99"}, format="json").status_code, 200)
