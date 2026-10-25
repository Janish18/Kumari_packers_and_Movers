import io
import json
import logging
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.bookings.models import Booking, Status
from apps.catalog.pricing import money
from apps.core.audit import log_action
from apps.core.permissions import IsAdminRole, IsCustomer
from apps.support.notify import notify

from .gateway import GatewayError, NotConfigured, get_gateway
from .models import Invoice, Payment, Refund, WebhookEvent
from .serializers import InvoiceSerializer, PaymentSerializer
from .services import accepted_quotation, advance_amount, amount_due, mark_success, refresh_invoice_status

logger = logging.getLogger(__name__)


class ServiceUnavailable(APIException):
    status_code = 503
    default_detail = "This feature is not configured yet."
    default_code = "not_configured"


class CustomerPaymentViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsCustomer]
    serializer_class = PaymentSerializer
    filterset_fields = ["status", "booking"]

    def get_queryset(self):
        return Payment.objects.filter(user=self.request.user).select_related("booking")

    @action(detail=False, methods=["post"], url_path="create-order")
    def create_order(self, request):
        """Body: {booking, kind: ADVANCE|BALANCE|FULL}. Amount is computed server-side, never taken from the client."""
        try:
            b = Booking.objects.get(pk=request.data.get("booking"), customer=request.user)
        except (Booking.DoesNotExist, ValueError, TypeError):
            raise ValidationError({"booking": "Booking not found."})
        q = accepted_quotation(b)
        if not q or b.status in (Status.CANCELLED, Status.REJECTED):
            raise ValidationError({"booking": "Payment is available after you accept a quotation."})
        due = amount_due(b)
        if not due:
            raise ValidationError({"booking": "Nothing is due on this booking."})
        kind = request.data.get("kind", "FULL")
        if kind == "ADVANCE":
            amount = min(advance_amount(q), due)
            if due < q.total:
                raise ValidationError({"kind": "The advance has already been paid."})
        elif kind in ("BALANCE", "FULL"):
            amount = due
        else:
            raise ValidationError({"kind": "Invalid payment type."})
        gw = get_gateway()
        if not gw.configured:
            raise ServiceUnavailable("Online payments are not configured yet. Please contact support to pay.")
        # Reuse an open order for the same amount (idempotent retries)
        p = Payment.objects.filter(booking=b, user=request.user, kind=kind, amount=amount,
                                   status__in=[Payment.PStatus.CREATED, Payment.PStatus.PENDING]).first()
        if not p:
            p = Payment.objects.create(booking=b, quotation=q, user=request.user, kind=kind, amount=amount, provider=gw.name)
            try:
                order = gw.create_order(amount, receipt=f"{b.reference}-{p.pk}")
            except GatewayError as exc:
                p.status, p.failure_reason = Payment.PStatus.FAILED, str(exc)
                p.save()
                raise ServiceUnavailable(str(exc))
            p.provider_order_id = order["order_id"]
            p.status = Payment.PStatus.PENDING
            p.save()
        return Response({"payment_id": p.id, "order_id": p.provider_order_id, "key_id": gw.key_id, "amount": p.amount,
                         "currency": p.currency, "provider": gw.name, "booking_reference": b.reference})

    @action(detail=False, methods=["post"])
    def verify(self, request):
        """Called after the browser checkout finishes. Success is decided ONLY by signature verification on the server."""
        order_id, pay_id, sig = (request.data.get(k) for k in ("order_id", "payment_id", "signature"))
        try:
            p = Payment.objects.get(provider_order_id=order_id, user=request.user)
        except Payment.DoesNotExist:
            raise ValidationError({"order_id": "Unknown payment order."})
        gw = get_gateway()
        try:
            ok = gw.verify_payment_signature(order_id, pay_id, sig)
        except NotConfigured as exc:
            raise ServiceUnavailable(str(exc))
        if not ok:
            if p.status in (Payment.PStatus.PENDING, Payment.PStatus.CREATED):
                p.status, p.failure_reason = Payment.PStatus.FAILED, "Signature verification failed"
                p.save()
            log_action(request, "payment_signature_failed", p, f"{p.booking.reference}")
            raise ValidationError({"signature": "Payment could not be verified."})
        p, changed = mark_success(p.pk, pay_id, request=request)
        return Response({"status": p.status, "already_processed": not changed, "payment": PaymentSerializer(p).data})


class WebhookView(APIView):
    """Provider -> us. Authenticity via HMAC of the raw body; duplicates ignored by unique event id."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def post(self, request):
        gw = get_gateway()
        body = request.body
        try:
            valid = gw.verify_webhook(body, request.headers.get("X-Razorpay-Signature", ""))
        except NotConfigured:
            return Response({"detail": "Webhook not configured."}, status=503)
        if not valid:
            logger.warning("Rejected webhook with invalid signature")
            return Response({"detail": "Invalid signature."}, status=400)
        try:
            payload = json.loads(body)
        except ValueError:
            return Response({"detail": "Bad payload."}, status=400)
        event_id = request.headers.get("X-Razorpay-Event-Id") or payload.get("id") or ""
        etype = payload.get("event", "")
        if not event_id:
            return Response({"detail": "Missing event id."}, status=400)
        try:
            with transaction.atomic():
                ev = WebhookEvent.objects.create(provider=gw.name, event_id=event_id, event_type=etype)
        except IntegrityError:
            return Response({"status": "duplicate_ignored"})
        outcome = self._handle(etype, payload)
        WebhookEvent.objects.filter(pk=ev.pk).update(processed=True, outcome=outcome[:120])
        return Response({"status": "ok", "outcome": outcome})

    @staticmethod
    def _handle(etype, payload):
        ent = (payload.get("payload", {}).get("payment", {}) or {}).get("entity", {})
        if etype in ("payment.captured", "order.paid"):
            if etype == "order.paid":
                ent = (payload.get("payload", {}).get("payment", {}) or {}).get("entity", {})
            p = Payment.objects.filter(provider_order_id=ent.get("order_id")).first()
            if not p:
                return "unknown_order"
            _, changed = mark_success(p.pk, ent.get("id"), source="webhook")
            return "marked_success" if changed else "already_success"
        if etype == "payment.failed":
            p = Payment.objects.filter(provider_order_id=ent.get("order_id")).first()
            if p and p.status in (Payment.PStatus.PENDING, Payment.PStatus.CREATED):
                p.status, p.failure_reason = Payment.PStatus.FAILED, (ent.get("error_description") or "Payment failed")[:255]
                p.save()
                return "marked_failed"
            return "ignored"
        if etype == "refund.processed":
            rid = ((payload.get("payload", {}).get("refund", {}) or {}).get("entity", {}) or {}).get("id")
            n = Refund.objects.filter(provider_refund_id=rid).update(status=Refund.RStatus.PROCESSED)
            return "refund_processed" if n else "unknown_refund"
        return "ignored"


class CustomerInvoiceViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsCustomer]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        return Invoice.objects.filter(booking__customer=self.request.user).select_related("booking")

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        inv = self.get_object()
        return invoice_pdf_response(inv)


def invoice_pdf_response(inv):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm)
    st = getSampleStyleSheet()
    b, q = inv.booking, inv.quotation
    els = [Paragraph("Kumari Packers and Movers", st["Title"]), Paragraph(f"Invoice {inv.number}", st["Heading2"]),
           Paragraph(f"Booking {b.reference} &nbsp;|&nbsp; Date {inv.created_at:%d %b %Y} &nbsp;|&nbsp; Status {inv.get_status_display()}", st["Normal"]),
           Paragraph(f"Billed to: {b.customer.full_name} ({b.customer.email})", st["Normal"]),
           Paragraph(f"Move: {b.pickup_city} to {b.drop_city} on {b.move_date:%d %b %Y}", st["Normal"]), Spacer(1, 8 * mm)]
    rows = [["Description", "Qty", "Unit (INR)", "Amount (INR)"]]
    for l in q.lines.all():
        rows.append([l.label, f"{l.quantity:g}", f"{l.unit_price:,.2f}", f"{l.line_total:,.2f}"])
    rows += [["", "", "Subtotal", f"{inv.subtotal:,.2f}"], ["", "", "Discount", f"-{inv.discount:,.2f}"],
             ["", "", "GST", f"{inv.tax:,.2f}"], ["", "", "Total", f"{inv.total:,.2f}"]]
    t = Table(rows, colWidths=[85 * mm, 18 * mm, 32 * mm, 35 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#101B36")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                           ("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("GRID", (0, 0), (-1, -len(rows) + len(q.lines.all()) + 1), 0.25, colors.grey),
                           ("FONTNAME", (2, -1), (-1, -1), "Helvetica-Bold")]))
    els.append(t)
    doc.build(els)
    resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{inv.number}.pdf"'
    return resp


class AdminPaymentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminRole]
    queryset = Payment.objects.select_related("booking", "user").prefetch_related("refunds")
    serializer_class = PaymentSerializer
    filterset_fields = ["status", "booking", "kind"]
    search_fields = ["booking__reference", "user__full_name", "provider_order_id", "provider_payment_id"]

    @action(detail=True, methods=["post"])
    def refund(self, request, pk=None):
        with transaction.atomic():
            p = Payment.objects.select_for_update().get(pk=pk)
            if p.status not in (Payment.PStatus.SUCCESS, Payment.PStatus.PARTIALLY_REFUNDED):
                raise ValidationError({"payment": "Only successful payments can be refunded."})
            already = sum((r.amount for r in p.refunds.exclude(status=Refund.RStatus.FAILED)), Decimal(0))
            try:
                amount = money(Decimal(str(request.data.get("amount", p.amount - already))))
            except Exception:
                raise ValidationError({"amount": "Enter a valid amount."})
            reason = str(request.data.get("reason", "")).strip()
            if not reason:
                raise ValidationError({"reason": "A reason is required."})
            if amount <= 0 or amount > p.amount - already:
                raise ValidationError({"amount": "Refund must be positive and not exceed the refundable balance."})
            gw = get_gateway()
            try:
                rid = gw.refund(p.provider_payment_id, amount)
            except NotConfigured as exc:
                raise ServiceUnavailable(str(exc))
            except GatewayError as exc:
                raise ServiceUnavailable(str(exc))
            r = Refund.objects.create(payment=p, amount=amount, reason=reason[:255], provider_refund_id=rid, requested_by=request.user)
            p.status = Payment.PStatus.REFUNDED if already + amount >= p.amount else Payment.PStatus.PARTIALLY_REFUNDED
            p.save()
            refresh_invoice_status(p.booking)
            log_action(request, "refund_issued", p, f"{p.booking.reference} INR {amount}", {"reason": reason})
        notify(p.user, "REFUND", f"Refund initiated for {p.booking.reference}", f"INR {amount} will be returned to your original payment method.", booking=p.booking)
        return Response(PaymentSerializer(p).data)
