from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import BusinessConfiguration
from apps.core.audit import log_action
from apps.core.permissions import IsCustomer
from apps.core.uploads import save_upload
from apps.payments.services import amount_due, paid_total
from apps.support.notify import notify, notify_admins

from .models import JOB_ACTIVE, Booking, JobEvent, Quotation, RescheduleRequest, SCHEDULED, Status
from .quotes import accept_quotation
from .serializers import (BookingDetailSerializer, BookingInputSerializer, BookingListSerializer, EventSerializer,
                          HistorySerializer, QuotationSerializer)
from .workflow import Conflict, check_capacity, transition


class CustomerBookingViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                             mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsCustomer]
    filterset_fields = ["status"]
    search_fields = ["reference", "pickup_city", "drop_city"]
    ordering_fields = ["created_at", "move_date"]

    def get_queryset(self):  # ownership enforced for EVERY action through this queryset
        return (Booking.objects.filter(customer=self.request.user, is_archived=False)
                .select_related("service", "driver__user", "driver__vehicle").prefetch_related("quotations__lines", "inventory", "history"))

    def get_serializer_class(self):
        return BookingListSerializer if self.action == "list" else BookingDetailSerializer

    def create(self, request, *a, **kw):
        ser = BookingInputSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        b = ser.save()
        return Response(BookingDetailSerializer(b).data, status=status.HTTP_201_CREATED)

    def update(self, request, *a, **kw):
        b = self.get_object()
        ser = BookingInputSerializer(data=request.data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        b = ser.update(b, ser.validated_data)
        return Response(BookingDetailSerializer(b).data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        b = self.get_object()
        b = transition(b.pk, Status.QUOTE_REQUESTED, request.user, request=request, expected_status=Status.DRAFT)
        return Response(BookingDetailSerializer(b).data)

    @action(detail=True, methods=["post"], url_path="accept-quote")
    def accept_quote(self, request, pk=None):
        b = self.get_object()
        accept_quotation(b.pk, request.user, request.data.get("quotation_id"), request=request)
        return Response(BookingDetailSerializer(Booking.objects.get(pk=b.pk)).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        b = self.get_object()
        b = transition(b.pk, Status.CANCELLED, request.user, reason=str(request.data.get("reason", "")), request=request)
        notify_admins("BOOKING_CANCELLED", f"Booking cancelled: {b.reference}", b.cancelled_reason, booking=b)
        data = BookingDetailSerializer(b).data
        data["message"] = ("Booking cancelled. A late-cancellation fee may apply as per our cancellation policy."
                           if b.late_cancellation else "Booking cancelled.")
        return Response(data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def reschedule(self, request, pk=None):
        b = Booking.objects.select_for_update().get(pk=self.get_object().pk)
        if b.status not in (Status.QUOTE_REQUESTED, Status.QUOTE_PREPARED, Status.QUOTE_ACCEPTED, Status.CONFIRMED, Status.DRIVER_ASSIGNED):
            raise ValidationError({"status": "This booking can no longer be rescheduled."})
        new_date = BookingInputSerializer().fields["move_date"].run_validation(request.data.get("requested_date"))
        slot = str(request.data.get("requested_slot", ""))[:30]
        reason = str(request.data.get("reason", ""))[:255]
        if new_date == b.move_date and slot in ("", b.time_slot):
            raise ValidationError({"requested_date": "Choose a different date or time slot."})
        if b.reschedules.filter(status=RescheduleRequest.RStatus.PENDING).exists():
            raise Conflict("You already have a pending reschedule request.")
        auto = b.status in (Status.QUOTE_REQUESTED, Status.QUOTE_PREPARED, Status.QUOTE_ACCEPTED)
        r = RescheduleRequest.objects.create(booking=b, requested_date=new_date, requested_slot=slot, reason=reason)
        if auto:
            b.move_date, b.time_slot = new_date, slot or b.time_slot
            b.save()
            r.status = RescheduleRequest.RStatus.APPROVED
            r.decision_note = "Applied automatically before confirmation"
            r.save()
            msg = "Your move date has been updated."
        else:
            notify_admins("RESCHEDULE_REQUEST", f"Reschedule requested: {b.reference}", f"New date {new_date}. {reason}", booking=b)
            msg = "Reschedule requested. We will confirm shortly."
        notify(request.user, "SCHEDULE", f"Reschedule update for {b.reference}", msg, booking=b)
        data = BookingDetailSerializer(b).data
        data["message"] = msg
        return Response(data)

    @action(detail=True, methods=["get"])
    def tracking(self, request, pk=None):
        b = self.get_object()
        live = {"available": False, "reason": "Live location is not available for this booking right now.", "last_location": None}
        if b.status in JOB_ACTIVE and b.driver_id:
            if not b.driver.share_location:
                live["reason"] = "The driver has not enabled location sharing."
            else:
                ping = b.pings.filter(driver=b.driver).first()
                if ping:
                    live = {"available": True, "reason": "", "last_location": {
                        "latitude": ping.latitude, "longitude": ping.longitude, "recorded_at": ping.recorded_at}}
                else:
                    live["reason"] = "Waiting for the first location update from the driver."
        elif b.status in (Status.COMPLETED, Status.CANCELLED):
            live["reason"] = "Tracking has ended for this booking."
        from django.conf import settings
        detail = BookingDetailSerializer(b).data
        return Response({
            "reference": b.reference, "status": b.status, "status_label": b.get_status_display(),
            "timeline": HistorySerializer(b.history.all(), many=True).data,
            "events": EventSerializer(b.events.filter(customer_visible=True), many=True).data,
            "pickup": {"line1": b.pickup_line1, "city": b.pickup_city, "pincode": b.pickup_pincode},
            "drop": {"line1": b.drop_line1, "city": b.drop_city, "pincode": b.drop_pincode},
            "move_date": b.move_date, "time_slot": b.time_slot, "driver_info": detail["driver_info"],
            "live": live, "map_configured": bool(settings.MAPS_PROVIDER and settings.MAPS_API_KEY),
        })

    @action(detail=True, methods=["post"], url_path="photos", parser_classes=[MultiPartParser, FormParser])
    def photos(self, request, pk=None):
        b = self.get_object()
        f = request.FILES.get("file")
        if not f:
            raise ValidationError({"file": "Attach an image file."})
        if b.files.filter(purpose="ITEM_PHOTO").count() >= 12:
            raise ValidationError({"file": "Maximum 12 photos per booking."})
        up = save_upload(request.user, f, "ITEM_PHOTO", b)
        return Response({"id": up.id, "url": up.file.url}, status=201)


class CustomerDashboardView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        qs = Booking.objects.filter(customer=request.user, is_archived=False)
        today = timezone.localdate()
        upcoming = qs.filter(status__in=SCHEDULED | {Status.QUOTE_ACCEPTED}, move_date__gte=today).order_by("move_date").first()
        active = qs.filter(status__in=JOB_ACTIVE).first()
        quotes = Quotation.objects.filter(booking__customer=request.user).select_related("booking")[:5]
        awaiting = qs.filter(status=Status.QUOTE_PREPARED).count()
        due_total = sum((amount_due(b) or 0 for b in qs.filter(status__in=[Status.QUOTE_ACCEPTED, *SCHEDULED, Status.COMPLETED])), 0)
        paid = sum((paid_total(b) for b in qs), 0)
        from apps.support.models import Notification
        return Response({
            "counts": {"total": qs.count(), "active": qs.exclude(status__in=["COMPLETED", "CANCELLED", "REJECTED"]).count(),
                       "awaiting_quote_acceptance": awaiting, "completed": qs.filter(status="COMPLETED").count()},
            "upcoming_move": BookingListSerializer(upcoming).data if upcoming else None,
            "active_booking": BookingListSerializer(active).data if active else None,
            "recent_quotations": QuotationSerializer(quotes, many=True).data,
            "payments": {"paid": paid, "due": due_total},
            "unread_notifications": Notification.objects.filter(user=request.user, is_read=False).count(),
        })
