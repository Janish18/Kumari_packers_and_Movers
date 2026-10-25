from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.bookings.models import Quotation
from apps.catalog.models import BusinessConfiguration
from apps.core.audit import log_action
from apps.support.notify import notify

from .models import Invoice, Payment, Refund
from .pricing_helpers import money


def paid_total(booking):
    s = Payment.objects.filter(booking=booking, status__in=[Payment.PStatus.SUCCESS, Payment.PStatus.PARTIALLY_REFUNDED]).aggregate(t=Sum("amount"))["t"] or Decimal(0)
    r = Refund.objects.filter(payment__booking=booking).exclude(status=Refund.RStatus.FAILED).aggregate(t=Sum("amount"))["t"] or Decimal(0)
    return money(s - r)


def accepted_quotation(booking):
    return booking.quotations.filter(status=Quotation.QStatus.ACCEPTED).first()


def amount_due(booking):
    q = accepted_quotation(booking)
    if not q:
        return None
    return money(max(q.total - paid_total(booking), Decimal(0)))


def advance_amount(quotation):
    pct = Decimal(str(BusinessConfiguration.get("advance_percent", 25) or 25))
    return money(quotation.total * pct / Decimal(100))


def next_invoice_number():
    n = Invoice.objects.count() + 1
    return f"KPM-INV-{timezone.now():%y%m}-{n:05d}"


def ensure_invoice(booking, quotation):
    inv = Invoice.objects.filter(booking=booking).first()
    if inv:
        return inv
    for _ in range(5):
        try:
            with transaction.atomic():
                return Invoice.objects.create(booking=booking, quotation=quotation, number=next_invoice_number(),
                                              subtotal=quotation.subtotal, discount=quotation.discount, tax=quotation.gst,
                                              total=quotation.total)
        except Exception:
            continue
    raise ValidationError("Could not issue invoice. Please retry.")


def refresh_invoice_status(booking):
    inv = Invoice.objects.filter(booking=booking).first()
    if not inv:
        return
    paid = paid_total(booking)
    inv.status = Invoice.IStatus.PAID if paid >= inv.total else (Invoice.IStatus.PART_PAID if paid > 0 else Invoice.IStatus.ISSUED)
    inv.save(update_fields=["status", "updated_at"])


@transaction.atomic
def mark_success(payment_id, provider_payment_id, request=None, source="verify"):
    """Idempotently mark a payment successful after trusted verification (signature or webhook)."""
    p = Payment.objects.select_for_update().get(pk=payment_id)
    if p.status == Payment.PStatus.SUCCESS:
        return p, False
    if p.status not in (Payment.PStatus.CREATED, Payment.PStatus.PENDING, Payment.PStatus.FAILED):
        return p, False
    p.status = Payment.PStatus.SUCCESS
    p.provider_payment_id = provider_payment_id
    p.verified_at = timezone.now()
    p.failure_reason = ""
    p.save()
    refresh_invoice_status(p.booking)
    notify(p.user, "PAYMENT", f"Payment received for {p.booking.reference}",
           f"We received your payment of INR {p.amount}.", booking=p.booking)
    log_action(request, "payment_verified", p, f"{p.booking.reference} INR {p.amount} via {source}", actor=p.user)
    return p, True
