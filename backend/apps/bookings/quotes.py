from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.catalog.models import BusinessConfiguration
from apps.catalog.pricing import calculate_estimate, money
from apps.core.audit import log_action
from apps.support.notify import notify

from .models import Booking, Quotation, QuotationLineItem, Status
from .workflow import Conflict, transition


def estimate_for_booking(b, **override):
    return calculate_estimate(
        property_type=b.property_type, distance_km=override.get("distance_km", b.distance_km), packing=b.packing_required,
        loading=b.loading_required, unloading=b.unloading_required, pickup_floor=b.pickup_floor,
        pickup_elevator=b.pickup_elevator, drop_floor=b.drop_floor, drop_elevator=b.drop_elevator,
        vehicle_category=override.get("vehicle_category", b.vehicle_category) or None,
        addons=override.get("addons", b.addons),
    )


@transaction.atomic
def create_quotation(booking_id, admin, data, request=None):
    b = Booking.objects.select_for_update().get(pk=booking_id)
    if b.status not in (Status.QUOTE_REQUESTED, Status.QUOTE_PREPARED):
        raise ValidationError({"status": "A quotation can only be issued while the quote is being prepared."})

    if "distance_km" in data and data["distance_km"] is not None:
        b.distance_km = data["distance_km"]
    if data.get("vehicle_category"):
        b.vehicle_category = data["vehicle_category"]
    if "addons" in data:
        b.addons = list(data["addons"])
    b.save()

    lines = []
    if data.get("use_pricing_rules", True):
        est = estimate_for_booking(b)
        if est["configured"]:
            lines.extend(est["lines"])
    for ex in data.get("extra_lines", []):
        qty, price = Decimal(str(ex.get("quantity", 1))), Decimal(str(ex["unit_price"]))
        lines.append({"code": "MANUAL", "label": ex["label"], "quantity": qty, "unit_price": price, "line_total": money(qty * price)})
    if not lines:
        raise ValidationError({"lines": "No pricing rules are configured for this booking. Add manual line items or configure pricing rules."})

    subtotal = money(sum((Decimal(l["line_total"]) for l in lines), Decimal(0)))
    discount = money(Decimal(str(data.get("discount", 0) or 0)))
    if discount < 0 or discount > subtotal:
        raise ValidationError({"discount": "Discount must be between 0 and the subtotal."})
    gst_pct = Decimal(str(BusinessConfiguration.get("gst_percent", 0) or 0))
    gst = money((subtotal - discount) * gst_pct / Decimal(100))
    days = int(data.get("valid_days") or BusinessConfiguration.get("quote_validity_days", 7) or 7)

    Quotation.objects.filter(booking=b, status=Quotation.QStatus.SENT).update(status=Quotation.QStatus.SUPERSEDED)
    version = (b.quotations.order_by("-version").values_list("version", flat=True).first() or 0) + 1
    q = Quotation.objects.create(booking=b, version=version, subtotal=subtotal, discount=discount,
                                 discount_reason=data.get("discount_reason", "")[:200], gst_percent=gst_pct, gst=gst,
                                 total=money(subtotal - discount + gst), valid_until=timezone.localdate() + timedelta(days=days),
                                 notes=data.get("notes", ""), created_by=admin)
    QuotationLineItem.objects.bulk_create([QuotationLineItem(quotation=q, code=l["code"], label=l["label"], quantity=l["quantity"],
                                           unit_price=l["unit_price"], line_total=l["line_total"]) for l in lines])
    log_action(request, "quotation_issued", q, f"{b.reference} v{version} total {q.total}", {"discount": str(discount)}, actor=admin)
    if b.status == Status.QUOTE_REQUESTED:
        transition(b.pk, Status.QUOTE_PREPARED, admin, request=request)
    notify(b.customer, "QUOTATION", f"Quotation ready for {b.reference}",
           f"Your quotation (v{version}) of INR {q.total} is valid until {q.valid_until}.", booking=b)
    return q


@transaction.atomic
def accept_quotation(booking_id, customer, quotation_id=None, request=None):
    b = Booking.objects.select_for_update().get(pk=booking_id, customer=customer)
    if b.status == Status.QUOTE_ACCEPTED:
        raise Conflict("This quotation has already been accepted.")
    if b.status != Status.QUOTE_PREPARED:
        raise ValidationError({"status": "There is no quotation awaiting your acceptance."})
    q = b.quotations.select_for_update().filter(status=Quotation.QStatus.SENT).order_by("-version").first()
    if not q or (quotation_id and q.pk != int(quotation_id)):
        raise Conflict("This quotation is no longer current. Please review the latest quotation.")
    if q.is_expired:
        q.status = Quotation.QStatus.EXPIRED
        q.save(update_fields=["status"])
        raise ValidationError({"quotation": "This quotation has expired. Please ask us to re-issue it."})
    q.status, q.accepted_at, q.accepted_by = Quotation.QStatus.ACCEPTED, timezone.now(), customer
    q.save()
    transition(b.pk, Status.QUOTE_ACCEPTED, customer, request=request)
    from apps.payments.services import ensure_invoice
    ensure_invoice(b, q)
    from apps.support.notify import notify_admins
    notify_admins("QUOTE_ACCEPTED", f"Quotation accepted: {b.reference}", f"{customer.full_name} accepted v{q.version} (INR {q.total}).", booking=b)
    notify(customer, "QUOTATION", f"Quotation accepted for {b.reference}", "Thanks! We will confirm your booking shortly.", booking=b)
    return q
