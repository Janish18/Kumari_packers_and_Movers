"""Payment gateway adapter. Razorpay (sandbox keys) is the first provider; swap by adding another class."""
import hashlib
import hmac
import json
from decimal import Decimal

from django.conf import settings


class NotConfigured(Exception):
    pass


class GatewayError(Exception):
    pass


def _eq(a, b):
    return hmac.compare_digest(str(a), str(b))


class RazorpayGateway:
    name = "razorpay"

    def __init__(self):
        self.key_id, self.secret = settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET
        self.webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET

    @property
    def configured(self):
        return bool(self.key_id and self.secret)

    def _client(self):
        if not self.configured:
            raise NotConfigured("Payments are not configured yet.")
        import razorpay
        return razorpay.Client(auth=(self.key_id, self.secret))

    def create_order(self, amount: Decimal, receipt: str, currency="INR"):
        try:
            order = self._client().order.create({"amount": int(amount * 100), "currency": currency, "receipt": receipt[:40]})
        except NotConfigured:
            raise
        except Exception as exc:
            raise GatewayError("The payment provider could not create the order.") from exc
        return {"order_id": order["id"], "key_id": self.key_id, "amount": amount, "currency": currency}

    def verify_payment_signature(self, order_id, payment_id, signature):
        if not self.configured:
            raise NotConfigured("Payments are not configured yet.")
        expected = hmac.new(self.secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
        return _eq(expected, signature or "")

    def verify_webhook(self, body: bytes, signature: str):
        if not self.webhook_secret:
            raise NotConfigured("Webhook secret is not configured.")
        expected = hmac.new(self.webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        return _eq(expected, signature or "")

    def refund(self, provider_payment_id, amount: Decimal):
        try:
            r = self._client().payment.refund(provider_payment_id, {"amount": int(amount * 100)})
        except NotConfigured:
            raise
        except Exception as exc:
            raise GatewayError("The payment provider rejected the refund.") from exc
        return r["id"]


class MockGateway(RazorpayGateway):
    """Deterministic fake used ONLY by automated tests (PAYMENT_PROVIDER=mock and TESTING)."""
    name = "mock"
    configured = True

    def __init__(self):
        self.key_id, self.secret, self.webhook_secret = "mock_key", "mock_secret", "mock_hook"

    def create_order(self, amount, receipt, currency="INR"):
        return {"order_id": f"order_{receipt}", "key_id": self.key_id, "amount": amount, "currency": currency}

    def refund(self, provider_payment_id, amount):
        return f"rfnd_{provider_payment_id}"


def get_gateway():
    if settings.PAYMENT_PROVIDER == "mock" and getattr(settings, "TESTING", False):
        return MockGateway()
    return RazorpayGateway()
