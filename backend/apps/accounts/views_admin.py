from django.db.models import Count
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.audit import log_action
from apps.core.permissions import IsAdminRole

from .models import DriverProfile, Role, User, Vehicle
from .serializers import CustomerAdminSerializer, DriverAdminSerializer, VehicleSerializer


class AdminCustomerViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """List/view customers; enable/disable only. Hard deletion is not offered (records must be retained)."""
    permission_classes = [IsAdminRole]
    serializer_class = CustomerAdminSerializer
    filterset_fields = ["is_active"]
    search_fields = ["full_name", "email", "phone"]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        return User.objects.filter(role=Role.CUSTOMER).annotate(bookings_count=Count("bookings"))

    def perform_update(self, ser):
        before = ser.instance.is_active
        u = ser.save()
        if before != u.is_active:
            log_action(self.request, "customer_enabled" if u.is_active else "customer_disabled", u,
                       f"{u.email}: {u.disabled_reason}"[:255])
            if not u.is_active:
                from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
                for t in OutstandingToken.objects.filter(user=u):
                    BlacklistedToken.objects.get_or_create(token=t)

    @action(detail=True, methods=["get"])
    def bookings(self, request, pk=None):
        from apps.bookings.models import Booking
        from apps.bookings.serializers import BookingListSerializer
        qs = Booking.objects.filter(customer_id=pk).select_related("service")[:50]
        return Response(BookingListSerializer(qs, many=True).data)


class AdminDriverViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = DriverAdminSerializer
    queryset = DriverProfile.objects.select_related("user", "vehicle")
    filterset_fields = ["approval", "availability"]
    search_fields = ["user__full_name", "user__email", "user__phone", "license_number"]

    def perform_create(self, ser):
        d = ser.save()
        log_action(self.request, "driver_created", d, d.user.email)

    def perform_update(self, ser):
        d = ser.save()
        log_action(self.request, "driver_updated", d, d.user.email)

    def perform_destroy(self, d):  # soft: deactivate rather than delete (assignments must be retained)
        d.user.is_active = False
        d.user.save(update_fields=["is_active"])
        d.approval, d.availability = DriverProfile.Approval.SUSPENDED, DriverProfile.Availability.OFF_DUTY
        d.save()
        log_action(self.request, "driver_deactivated", d, d.user.email)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        d = self.get_object()
        d.approval = DriverProfile.Approval.APPROVED
        d.availability = d.availability if d.availability != DriverProfile.Availability.OFF_DUTY else DriverProfile.Availability.AVAILABLE
        d.save()
        log_action(request, "driver_approved", d, d.user.email)
        return Response(self.get_serializer(d).data)

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        d = self.get_object()
        d.approval = DriverProfile.Approval.SUSPENDED
        d.save()
        log_action(request, "driver_suspended", d, d.user.email)
        return Response(self.get_serializer(d).data)

    @action(detail=True, methods=["get"])
    def performance(self, request, pk=None):
        from django.db.models import Avg
        from apps.bookings.models import Booking
        from apps.support.models import Review
        d = self.get_object()
        done = Booking.objects.filter(driver=d, status="COMPLETED").count()
        agg = Review.objects.filter(booking__assignments__driver=d, status="APPROVED").aggregate(avg=Avg("driver_rating"), overall=Avg("rating"))
        return Response({"completed_jobs": done, "average_driver_rating": agg["avg"], "average_overall_rating": agg["overall"]})


class AdminVehicleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = VehicleSerializer
    queryset = Vehicle.objects.all()
    search_fields = ["registration_no"]

    def perform_create(self, ser):
        v = ser.save()
        log_action(self.request, "vehicle_created", v, v.registration_no)

    def perform_update(self, ser):
        v = ser.save()
        log_action(self.request, "vehicle_updated", v, v.registration_no)
