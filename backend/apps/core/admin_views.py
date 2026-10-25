import csv
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import DriverProfile
from apps.bookings.models import Booking, Quotation, Status
from apps.payments.models import Payment, Refund
from apps.payments.services import amount_due
from apps.support.models import Review

from .audit import log_action
from .models import AuditLog
from .permissions import IsAdminRole

OPEN_STATUSES = [Status.CONFIRMED, Status.DRIVER_ASSIGNED, Status.EN_ROUTE_TO_PICKUP, Status.LOADING, Status.IN_TRANSIT, Status.UNLOADING]
IN_PROGRESS = [Status.EN_ROUTE_TO_PICKUP, Status.LOADING, Status.IN_TRANSIT, Status.UNLOADING]


def verified_revenue(qs=None):
    qs = Payment.objects.all() if qs is None else qs
    paid = qs.filter(status__in=[Payment.PStatus.SUCCESS, Payment.PStatus.PARTIALLY_REFUNDED, Payment.PStatus.REFUNDED]).aggregate(t=Sum("amount"))["t"] or Decimal(0)
    refunded = Refund.objects.filter(payment__in=qs).exclude(status=Refund.RStatus.FAILED).aggregate(t=Sum("amount"))["t"] or Decimal(0)
    return paid - refunded


class AdminDashboardView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        today = timezone.localdate()
        b = Booking.objects.filter(is_archived=False)
        since = today - timedelta(days=29)
        trend = (b.filter(created_at__date__gte=since).annotate(d=TruncDate("created_at")).values("d").annotate(n=Count("id")).order_by("d"))
        trend_map = {t["d"]: t["n"] for t in trend}
        days = [since + timedelta(days=i) for i in range(30)]
        outstanding = Decimal(0)
        for bk in b.filter(status__in=[Status.QUOTE_ACCEPTED, *OPEN_STATUSES, Status.COMPLETED]).prefetch_related("quotations"):
            outstanding += amount_due(bk) or 0
        drivers = DriverProfile.objects.filter(approval="APPROVED", user__is_active=True)
        return Response({
            "metrics": {
                "total_bookings": b.count(),
                "pending_quotations": b.filter(status=Status.QUOTE_REQUESTED).count(),
                "awaiting_customer": b.filter(status=Status.QUOTE_PREPARED).count(),
                "confirmed_bookings": b.filter(status__in=[Status.CONFIRMED, Status.DRIVER_ASSIGNED]).count(),
                "jobs_in_progress": b.filter(status__in=IN_PROGRESS).count(),
                "completed_jobs": b.filter(status=Status.COMPLETED).count(),
                "cancellations": b.filter(status=Status.CANCELLED).count(),
                "needs_review": b.filter(status=Status.EXCEPTION_REQUIRES_REVIEW).count(),
                "revenue": verified_revenue(),
                "outstanding_balance": outstanding,
            },
            "drivers": {"total": drivers.count(), "available": drivers.filter(availability="AVAILABLE").count(),
                        "busy": drivers.filter(availability="BUSY").count(), "off_duty": drivers.filter(availability="OFF_DUTY").count(),
                        "pending_approval": DriverProfile.objects.filter(approval="PENDING").count()},
            "trend": [{"date": d.isoformat(), "bookings": trend_map.get(d, 0)} for d in days],
            "status_breakdown": list(b.values("status").annotate(count=Count("id")).order_by("-count")),
            "today_jobs": b.filter(move_date=today, status__in=OPEN_STATUSES).count(),
            "pending_reviews": Review.objects.filter(status="PENDING").count(),
        })


REPORTS = ("bookings", "revenue", "drivers", "cancellations", "quality")


class AdminReportView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        kind = request.query_params.get("type", "bookings")
        if kind not in REPORTS:
            raise ValidationError({"type": f"Choose one of {', '.join(REPORTS)}."})
        today = timezone.localdate()
        try:
            d_to = timezone.datetime.strptime(request.query_params.get("date_to", str(today)), "%Y-%m-%d").date()
            d_from = timezone.datetime.strptime(request.query_params.get("date_from", str(today - timedelta(days=29))), "%Y-%m-%d").date()
        except ValueError:
            raise ValidationError({"date": "Use YYYY-MM-DD."})
        if d_from > d_to:
            raise ValidationError({"date_from": "Start date must be before end date."})
        headers, rows = getattr(self, f"_{kind}")(d_from, d_to)
        if request.query_params.get("export") == "csv":
            log_action(request, "report_exported", ("Report", kind), f"{kind} {d_from}..{d_to}", {"rows": len(rows)})
            resp = HttpResponse(content_type="text/csv")
            resp["Content-Disposition"] = f'attachment; filename="kumari-{kind}-{d_from}-{d_to}.csv"'
            w = csv.writer(resp)
            w.writerow(headers)
            for r in rows:
                w.writerow([self._safe(c) for c in r])
            return resp
        return Response({"type": kind, "date_from": d_from, "date_to": d_to, "headers": headers, "rows": rows,
                         "summary": self._summary(kind, rows)})

    @staticmethod
    def _safe(v):  # neutralise spreadsheet formula injection in exports
        s = "" if v is None else str(v)
        return "'" + s if s[:1] in ("=", "+", "-", "@") else s

    @staticmethod
    def _summary(kind, rows):
        return {"count": len(rows)}

    def _bookings(self, a, z):
        qs = Booking.objects.filter(move_date__range=(a, z)).select_related("customer", "driver__user", "service")
        return (["Reference", "Move date", "Status", "Customer", "Service", "From", "To", "Driver"],
                [[x.reference, x.move_date, x.status, x.customer.full_name, x.service.name, x.pickup_city, x.drop_city,
                  x.driver.user.full_name if x.driver else ""] for x in qs])

    def _revenue(self, a, z):
        qs = Payment.objects.filter(created_at__date__range=(a, z)).select_related("booking", "user")
        return (["Date", "Booking", "Customer", "Kind", "Amount (INR)", "Status", "Provider ref"],
                [[p.created_at.date(), p.booking.reference, p.user.full_name, p.kind, p.amount, p.status, p.provider_payment_id or ""] for p in qs])

    def _drivers(self, a, z):
        qs = DriverProfile.objects.select_related("user").annotate(
            n_jobs=Count("jobs", filter=Q(jobs__move_date__range=(a, z))),
            n_done=Count("jobs", filter=Q(jobs__move_date__range=(a, z), jobs__status="COMPLETED")))
        return (["Driver", "Approval", "Availability", "Jobs in range", "Completed in range"],
                [[d.user.full_name, d.approval, d.availability, d.n_jobs, d.n_done] for d in qs])

    def _cancellations(self, a, z):
        qs = Booking.objects.filter(status__in=["CANCELLED", "REJECTED"], cancelled_at__date__range=(a, z)).select_related("customer", "cancelled_by")
        return (["Reference", "Status", "Customer", "Cancelled at", "By", "Late cancellation", "Reason"],
                [[b.reference, b.status, b.customer.full_name, b.cancelled_at, b.cancelled_by.full_name if b.cancelled_by else "", b.late_cancellation, b.cancelled_reason] for b in qs])

    def _quality(self, a, z):
        qs = Review.objects.filter(created_at__date__range=(a, z)).select_related("booking", "customer")
        return (["Booking", "Customer", "Rating", "Driver rating", "Status", "Comment"],
                [[r.booking.reference, r.customer.full_name, r.rating, r.driver_rating or "", r.status, r.comment[:200]] for r in qs])


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.full_name", default="System", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "actor_name", "action", "entity_type", "entity_id", "summary", "metadata", "ip_address", "created_at"]


class AdminAuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAdminRole]
    queryset = AuditLog.objects.select_related("actor")
    serializer_class = AuditLogSerializer
    filterset_fields = ["action", "entity_type", "entity_id"]
    search_fields = ["summary", "action", "actor__full_name"]
