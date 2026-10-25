from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.audit import log_action
from apps.core.permissions import IsAdminRole, IsCustomer
from apps.core.uploads import save_upload

from .models import DamageReport, Notification, Review, SupportTicket
from .notify import notify, notify_admins
from .serializers import (AdminDamageSerializer, AdminReviewSerializer, AdminTicketSerializer, DamageReportSerializer,
                          NotificationSerializer, PublicReviewSerializer, ReviewCreateSerializer, TicketSerializer)


class PublicReviews(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        qs = Review.objects.filter(status=Review.RStatus.APPROVED).select_related("customer")[:30]
        return Response(PublicReviewSerializer(qs, many=True).data)


class NotificationViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Any authenticated role can read their own notifications."""
    serializer_class = NotificationSerializer
    filterset_fields = ["is_read", "kind"]
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"message": "All notifications marked as read."})


class CustomerReviewViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsCustomer]
    serializer_class = ReviewCreateSerializer

    def get_queryset(self):
        return Review.objects.filter(customer=self.request.user)

    def perform_create(self, ser):
        r = ser.save(customer=self.request.user)
        notify_admins("REVIEW", f"New review for {r.booking.reference}", f"{r.rating}/5 - awaiting moderation", booking=r.booking)


class CustomerTicketViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsCustomer]
    serializer_class = TicketSerializer

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user)

    def perform_create(self, ser):
        t = ser.save(user=self.request.user)
        notify_admins("SUPPORT", f"New support ticket: {t.subject}", t.message[:200], booking=t.booking)
        notify(self.request.user, "SUPPORT", "We received your request", f"Ticket #{t.id}: {t.subject}", booking=t.booking)


class CustomerDamageViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsCustomer]
    serializer_class = DamageReportSerializer

    def get_queryset(self):
        return DamageReport.objects.filter(reporter=self.request.user)

    def perform_create(self, ser):
        d = ser.save(reporter=self.request.user)
        notify_admins("DAMAGE", f"{d.get_kind_display()} reported on {d.booking.reference}", d.item_name, booking=d.booking)

    @action(detail=True, methods=["post"], url_path="photos", parser_classes=[MultiPartParser, FormParser])
    def photos(self, request, pk=None):
        d = self.get_object()
        f = request.FILES.get("file")
        if not f:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"file": "Attach an image file."})
        up = save_upload(request.user, f, "DAMAGE", d.booking)
        return Response({"id": up.id}, status=201)


# ------------------------------------------------------------------ admin
class AdminReviewViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminRole]
    queryset = Review.objects.select_related("customer", "booking")
    serializer_class = AdminReviewSerializer
    filterset_fields = ["status", "rating"]
    http_method_names = ["get", "patch", "head", "options"]

    def perform_update(self, ser):
        r = ser.save()
        log_action(self.request, "review_moderated", r, f"{r.booking.reference} -> {r.status}")


class AdminTicketViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminRole]
    queryset = SupportTicket.objects.select_related("user", "booking")
    serializer_class = AdminTicketSerializer
    filterset_fields = ["status"]
    search_fields = ["subject", "user__full_name", "user__email"]
    http_method_names = ["get", "patch", "head", "options"]

    def perform_update(self, ser):
        t = ser.save()
        log_action(self.request, "ticket_updated", t, f"#{t.id} -> {t.status}")
        notify(t.user, "SUPPORT", f"Update on your request #{t.id}", t.resolution or f"Status: {t.get_status_display()}", booking=t.booking)


class AdminDamageViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminRole]
    queryset = DamageReport.objects.select_related("reporter", "booking")
    serializer_class = AdminDamageSerializer
    filterset_fields = ["status", "kind"]
    http_method_names = ["get", "patch", "head", "options"]

    def perform_update(self, ser):
        d = ser.save()
        log_action(self.request, "damage_report_updated", d, f"{d.booking.reference} -> {d.status}")
        notify(d.reporter, "SUPPORT", f"Update on your {d.get_kind_display().lower()} report", d.resolution or d.get_status_display(), booking=d.booking)
