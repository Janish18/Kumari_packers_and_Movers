from django.db import transaction
from django.utils import timezone
from django_filters import rest_framework as df
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import DriverProfile
from apps.core.audit import log_action
from apps.core.permissions import IsAdminRole
from apps.support.notify import notify

from .models import Booking, Quotation, RescheduleRequest, SCHEDULED, Status
from .quotes import create_quotation
from .serializers import AdminBookingListSerializer, AdminBookingSerializer, QuotationSerializer
from .workflow import Conflict, assign_driver, check_capacity, transition


class BookingFilter(df.FilterSet):
    date_from = df.DateFilter(field_name="move_date", lookup_expr="gte")
    date_to = df.DateFilter(field_name="move_date", lookup_expr="lte")
    destination = df.CharFilter(field_name="drop_city", lookup_expr="icontains")
    customer = df.NumberFilter(field_name="customer_id")
    driver = df.NumberFilter(field_name="driver_id")
    status = df.CharFilter(field_name="status")

    class Meta:
        model = Booking
        fields = ["status", "customer", "driver", "destination", "date_from", "date_to", "needs_manual_confirmation"]


class AdminBookingViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminRole]
    filterset_class = BookingFilter
    search_fields = ["reference", "customer__full_name", "customer__email", "pickup_city", "drop_city"]
    ordering_fields = ["created_at", "move_date", "status"]

    def get_queryset(self):
        return (Booking.objects.select_related("customer", "service", "driver__user", "driver__vehicle")
                .prefetch_related("quotations__lines", "inventory", "history", "events", "reschedules", "assignments__driver__user"))

    def get_serializer_class(self):
        return AdminBookingListSerializer if self.action == "list" else AdminBookingSerializer

    def _detail(self, pk):
        return Response(AdminBookingSerializer(self.get_queryset().get(pk=pk)).data)

    @action(detail=True, methods=["post"], url_path="update-status")
    def update_status(self, request, pk=None):
        to = request.data.get("status")
        if to not in Status.values:
            raise ValidationError({"status": "Unknown status."})
        transition(pk, to, request.user, reason=str(request.data.get("reason", "")), request=request,
                   expected_status=request.data.get("expected_status") or None)
        return self._detail(pk)

    @action(detail=True, methods=["post"], url_path="assign-driver")
    def assign_driver_action(self, request, pk=None):
        try:
            driver_id = int(request.data.get("driver"))
        except (TypeError, ValueError):
            raise ValidationError({"driver": "Select a driver."})
        assign_driver(pk, driver_id, request.user, team_notes=str(request.data.get("team_notes", "")), request=request)
        return self._detail(pk)

    @action(detail=True, methods=["post"])
    def quotations(self, request, pk=None):
        d = request.data
        extra = d.get("extra_lines", [])
        if not isinstance(extra, list):
            raise ValidationError({"extra_lines": "Must be a list."})
        for ex in extra:
            if not isinstance(ex, dict) or not ex.get("label") or "unit_price" not in ex:
                raise ValidationError({"extra_lines": "Each line needs a label and unit_price."})
            try:
                if float(ex["unit_price"]) < 0 or float(ex.get("quantity", 1)) <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                raise ValidationError({"extra_lines": "Invalid quantity or price."})
        create_quotation(pk, request.user, dict(d), request=request)
        return self._detail(pk)

    @action(detail=True, methods=["patch"], url_path="internal")
    def internal(self, request, pk=None):
        b = Booking.objects.get(pk=pk)
        if "internal_notes" in request.data:
            b.internal_notes = str(request.data["internal_notes"])[:4000]
        if "needs_manual_confirmation" in request.data:
            b.needs_manual_confirmation = bool(request.data["needs_manual_confirmation"])
        b.save()
        log_action(request, "booking_notes_updated", b, b.reference)
        return Response({"internal_notes": b.internal_notes, "needs_manual_confirmation": b.needs_manual_confirmation})

    @action(detail=True, methods=["get"], url_path="internal-notes")
    def internal_notes(self, request, pk=None):
        b = Booking.objects.get(pk=pk)
        return Response({"internal_notes": b.internal_notes})

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def reschedule(self, request, pk=None):
        b = Booking.objects.select_for_update().get(pk=pk)
        if b.status in (Status.COMPLETED, Status.CANCELLED, Status.REJECTED) or b.status in (Status.EN_ROUTE_TO_PICKUP, Status.LOADING, Status.IN_TRANSIT, Status.UNLOADING):
            raise ValidationError({"status": "This booking can no longer be rescheduled."})
        try:
            new_date = timezone.datetime.strptime(str(request.data.get("move_date")), "%Y-%m-%d").date()
        except ValueError:
            raise ValidationError({"move_date": "Use YYYY-MM-DD."})
        if new_date < timezone.localdate():
            raise ValidationError({"move_date": "Date cannot be in the past."})
        if b.driver_id and Booking.objects.filter(driver_id=b.driver_id, move_date=new_date, status__in=SCHEDULED).exclude(pk=b.pk).exists():
            raise Conflict("The assigned driver already has a job on that date. Reassign first.")
        old = b.move_date
        b.move_date = new_date
        b.time_slot = str(request.data.get("time_slot", b.time_slot))[:30]
        b.save()
        if b.status in (Status.CONFIRMED, Status.DRIVER_ASSIGNED):
            try:
                check_capacity(b)
            except Conflict:
                transaction.set_rollback(True)
                raise
        b.reschedules.filter(status=RescheduleRequest.RStatus.PENDING).update(status="APPROVED", decided_by=request.user, decision_note="Rescheduled by admin")
        log_action(request, "booking_rescheduled", b, f"{b.reference}: {old} -> {new_date}")
        notify(b.customer, "SCHEDULE", f"Move rescheduled: {b.reference}", f"Your move is now on {new_date}.", booking=b)
        return Response(AdminBookingSerializer(b).data)

    @action(detail=True, methods=["post"], url_path="resolve-reschedule")
    @transaction.atomic
    def resolve_reschedule(self, request, pk=None):
        b = Booking.objects.select_for_update().get(pk=pk)
        r = b.reschedules.select_for_update().filter(status="PENDING").first()
        if not r:
            raise ValidationError({"detail": "No pending reschedule request."})
        approve = bool(request.data.get("approve"))
        note = str(request.data.get("note", ""))[:255]
        if approve:
            if b.driver_id and Booking.objects.filter(driver_id=b.driver_id, move_date=r.requested_date, status__in=SCHEDULED).exclude(pk=b.pk).exists():
                raise Conflict("The assigned driver already has a job on that date.")
            b.move_date, b.time_slot = r.requested_date, r.requested_slot or b.time_slot
            b.save()
        r.status = "APPROVED" if approve else "DECLINED"
        r.decided_by, r.decision_note = request.user, note
        r.save()
        log_action(request, "reschedule_resolved", b, f"{b.reference} {r.status}")
        notify(b.customer, "SCHEDULE", f"Reschedule {r.status.lower()}: {b.reference}", note or (f"New date: {b.move_date}" if approve else "Original date kept."), booking=b)
        return Response(AdminBookingSerializer(b).data)


class AdminQuotationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminRole]
    queryset = Quotation.objects.select_related("booking").prefetch_related("lines")
    serializer_class = QuotationSerializer
    filterset_fields = ["status", "booking"]
    search_fields = ["booking__reference"]
