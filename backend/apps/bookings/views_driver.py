from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import DriverProfile
from apps.core.permissions import IsDriver
from apps.core.uploads import save_upload
from apps.support.notify import notify, notify_admins

from .models import JOB_ACTIVE, Booking, DriverAssignment, JobEvent, LocationPing, SCHEDULED, Status
from .serializers import DriverJobSerializer
from .workflow import Conflict, transition

DRIVER_EVENT_KINDS = {"ARRIVED_PICKUP", "LOADING_DONE", "ARRIVED_DROP", "UNLOADING_DONE", "DELAY", "ACCESS_PROBLEM", "NOTE", "EXCEPTION"}
VISIBLE_TO_CUSTOMER = {"ARRIVED_PICKUP", "LOADING_DONE", "ARRIVED_DROP", "UNLOADING_DONE", "DELAY", "ACCESS_PROBLEM"}


def profile_of(user):
    p = getattr(user, "driver_profile", None)
    if p is None:
        raise PermissionDenied("No driver profile is linked to this account.")
    return p


class DriverJobViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsDriver]
    serializer_class = DriverJobSerializer
    filterset_fields = ["status", "move_date"]
    ordering_fields = ["move_date"]

    def get_queryset(self):  # a driver can ONLY ever reach bookings currently assigned to them
        d = profile_of(self.request.user)
        return (Booking.objects.filter(driver=d).select_related("service", "customer").prefetch_related("inventory", "events", "assignments"))

    def _job(self, pk):
        return self.get_queryset().get(pk=pk)

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        b = self.get_object()
        a = b.assignments.filter(status=DriverAssignment.AStatus.ASSIGNED).first()
        if not a:
            raise Conflict("This assignment has already been acknowledged.")
        a.status, a.acknowledged_at = DriverAssignment.AStatus.ACKNOWLEDGED, timezone.now()
        a.save()
        JobEvent.objects.create(booking=b, kind=JobEvent.Kind.ACKNOWLEDGED, actor=request.user, note="Driver acknowledged the assignment")
        return Response(DriverJobSerializer(self._job(pk)).data)

    @action(detail=True, methods=["post"])
    def status(self, request, pk=None):
        b = self.get_object()
        to = request.data.get("status")
        if to not in Status.values:
            raise ValidationError({"status": "Unknown status."})
        if to == Status.COMPLETED:
            note = str(request.data.get("completion_note", "")).strip()
            if not b.files.filter(purpose="DELIVERY_PROOF").exists() and not note:
                raise ValidationError({"completion_note": "Upload delivery proof or add completion notes before completing the job."})
            if note:
                JobEvent.objects.create(booking=b, kind=JobEvent.Kind.NOTE, actor=request.user, note=f"Completion: {note}"[:500])
        elif to == Status.EN_ROUTE_TO_PICKUP and not b.assignments.filter(status=DriverAssignment.AStatus.ACKNOWLEDGED).exists():
            # acknowledgement is implied when the driver starts the job
            b.assignments.filter(status=DriverAssignment.AStatus.ASSIGNED).update(status=DriverAssignment.AStatus.ACKNOWLEDGED, acknowledged_at=timezone.now())
        transition(b.pk, to, request.user, reason=str(request.data.get("reason", "")), request=request,
                   expected_status=request.data.get("expected_status") or None, driver_scope=profile_of(request.user))
        if to == Status.EXCEPTION_REQUIRES_REVIEW:
            notify_admins("JOB_EXCEPTION", f"Exception on {b.reference}", str(request.data.get("reason", ""))[:200], booking=b)
        if to == Status.COMPLETED:
            notify(b.customer, "BOOKING_STATUS", f"Delivery completed: {b.reference}", "Your move is complete. Please rate your experience.", booking=b)
        return Response(DriverJobSerializer(self._job(pk)).data)

    @action(detail=True, methods=["post"])
    def events(self, request, pk=None):
        b = self.get_object()
        kind = request.data.get("kind")
        if kind not in DRIVER_EVENT_KINDS:
            raise ValidationError({"kind": "Unsupported event type."})
        if b.status not in JOB_ACTIVE | {Status.DRIVER_ASSIGNED, Status.EXCEPTION_REQUIRES_REVIEW}:
            raise ValidationError({"status": "Events can only be recorded on live jobs."})
        note = str(request.data.get("note", ""))[:500]
        if kind in ("DELAY", "ACCESS_PROBLEM", "EXCEPTION", "NOTE") and not note.strip():
            raise ValidationError({"note": "Please describe what happened."})
        JobEvent.objects.create(booking=b, kind=kind, actor=request.user, note=note, customer_visible=kind in VISIBLE_TO_CUSTOMER)
        if kind in ("DELAY", "ACCESS_PROBLEM"):
            notify(b.customer, "BOOKING_STATUS", f"Update on {b.reference}", note, booking=b)
        return Response(DriverJobSerializer(self._job(pk)).data, status=201)

    @action(detail=True, methods=["post"])
    def location(self, request, pk=None):
        d = profile_of(request.user)
        b = self.get_object()
        if not d.share_location:
            raise PermissionDenied("Location sharing is turned off in your profile.")
        if b.status not in JOB_ACTIVE:
            raise ValidationError({"status": "Location is only recorded during an active job."})
        try:
            lat, lng = Decimal(str(request.data["latitude"])), Decimal(str(request.data["longitude"]))
        except (KeyError, InvalidOperation):
            raise ValidationError({"latitude": "Valid latitude and longitude are required."})
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise ValidationError({"latitude": "Coordinates are out of range."})
        acc = request.data.get("accuracy_m")
        LocationPing.objects.create(booking=b, driver=d, latitude=round(lat, 6), longitude=round(lng, 6),
                                    accuracy_m=int(acc) if str(acc or "").isdigit() else None)
        return Response({"recorded": True}, status=201)

    @action(detail=True, methods=["post"], url_path="delivery-proof", parser_classes=[MultiPartParser, FormParser])
    def delivery_proof(self, request, pk=None):
        b = self.get_object()
        if b.status not in (Status.UNLOADING, Status.COMPLETED, Status.IN_TRANSIT):
            raise ValidationError({"status": "Proof can be added once the load is in transit, unloading or completed."})
        f = request.FILES.get("file")
        if not f:
            raise ValidationError({"file": "Attach an image file."})
        if b.files.filter(purpose="DELIVERY_PROOF").count() >= 10:
            raise ValidationError({"file": "Maximum 10 proof photos."})
        up = save_upload(request.user, f, "DELIVERY_PROOF", b)
        JobEvent.objects.create(booking=b, kind=JobEvent.Kind.PROOF, actor=request.user, note=str(request.data.get("note", ""))[:300], customer_visible=False)
        return Response({"id": up.id, "url": up.file.url}, status=201)


class DriverDashboardView(APIView):
    permission_classes = [IsDriver]

    def get(self, request):
        d = profile_of(request.user)
        today = timezone.localdate()
        jobs = Booking.objects.filter(driver=d).select_related("service")
        from apps.support.models import Notification
        ser = lambda qs: DriverJobSerializer(qs, many=True).data
        active = jobs.filter(status__in=JOB_ACTIVE).first()
        return Response({
            "profile": {"name": request.user.full_name, "approval": d.approval, "availability": d.availability,
                        "share_location": d.share_location, "vehicle": d.vehicle.registration_no if d.vehicle else None},
            "active_job": DriverJobSerializer(active).data if active else None,
            "today": ser(jobs.filter(move_date=today, status__in=SCHEDULED)),
            "upcoming": ser(jobs.filter(move_date__gt=today, status__in=SCHEDULED).order_by("move_date")[:10]),
            "completed_count": jobs.filter(status=Status.COMPLETED).count(),
            "unread_notifications": Notification.objects.filter(user=request.user, is_read=False).count(),
        })

    def patch(self, request):
        """Driver can only change own availability and location-sharing consent."""
        d = profile_of(request.user)
        if "availability" in request.data:
            v = request.data["availability"]
            if v not in (DriverProfile.Availability.AVAILABLE, DriverProfile.Availability.OFF_DUTY):
                raise ValidationError({"availability": "Choose Available or Off duty."})
            if d.availability == DriverProfile.Availability.BUSY:
                raise ValidationError({"availability": "You cannot change availability during an active job."})
            if v == DriverProfile.Availability.AVAILABLE and d.approval != DriverProfile.Approval.APPROVED:
                raise ValidationError({"availability": "Your account is awaiting approval."})
            d.availability = v
        if "share_location" in request.data:
            d.share_location = bool(request.data["share_location"])
        d.save()
        return Response({"availability": d.availability, "share_location": d.share_location})
