from django.conf import settings
from django.db import models

from apps.core.models import TimeStamped


class Payment(TimeStamped):
    class Kind(models.TextChoices):
        ADVANCE = "ADVANCE", "Advance"
        BALANCE = "BALANCE", "Balance"
        FULL = "FULL", "Full payment"

    class PStatus(models.TextChoices):
        CREATED = "CREATED", "Order created"
        PENDING = "PENDING", "Pending"
        SUCCESS = "SUCCESS", "Successful"
        FAILED = "FAILED", "Failed"
        PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED", "Partially refunded"
        REFUNDED = "REFUNDED", "Refunded"

    booking = models.ForeignKey("bookings.Booking", on_delete=models.PROTECT, related_name="payments")
    quotation = models.ForeignKey("bookings.Quotation", null=True, on_delete=models.PROTECT, related_name="payments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payments")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    status = models.CharField(max_length=20, choices=PStatus.choices, default=PStatus.CREATED, db_index=True)
    provider = models.CharField(max_length=20)
    provider_order_id = models.CharField(max_length=80, unique=True, null=True, blank=True)
    provider_payment_id = models.CharField(max_length=80, unique=True, null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.CharField(max_length=255, blank=True)
    # Only provider tokens/references are stored. Never card numbers or CVV.

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.CheckConstraint(condition=models.Q(amount__gt=0), name="payment_amount_gt_0")]


class WebhookEvent(models.Model):
    provider = models.CharField(max_length=20)
    event_id = models.CharField(max_length=100, unique=True)
    event_type = models.CharField(max_length=60)
    received_at = models.DateTimeField(auto_now_add=True)
    processed = models.BooleanField(default=False)
    outcome = models.CharField(max_length=120, blank=True)


class Refund(TimeStamped):
    class RStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSED = "PROCESSED", "Processed"
        FAILED = "FAILED", "Failed"

    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="refunds")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=255)
    status = models.CharField(max_length=10, choices=RStatus.choices, default=RStatus.PENDING)
    provider_refund_id = models.CharField(max_length=80, blank=True)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.CheckConstraint(condition=models.Q(amount__gt=0), name="refund_amount_gt_0")]


class Invoice(TimeStamped):
    class IStatus(models.TextChoices):
        ISSUED = "ISSUED", "Issued"
        PART_PAID = "PART_PAID", "Partly paid"
        PAID = "PAID", "Paid"
        VOID = "VOID", "Void"

    booking = models.OneToOneField("bookings.Booking", on_delete=models.PROTECT, related_name="invoice")
    quotation = models.ForeignKey("bookings.Quotation", on_delete=models.PROTECT, related_name="+")
    number = models.CharField(max_length=24, unique=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, choices=IStatus.choices, default=IStatus.ISSUED)
