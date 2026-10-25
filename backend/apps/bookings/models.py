import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStamped


class Status(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    QUOTE_REQUESTED = "QUOTE_REQUESTED", "Quote requested"
    QUOTE_PREPARED = "QUOTE_PREPARED", "Quote prepared"
    QUOTE_ACCEPTED = "QUOTE_ACCEPTED", "Quote accepted"
    CONFIRMED = "CONFIRMED", "Confirmed"
    DRIVER_ASSIGNED = "DRIVER_ASSIGNED", "Driver assigned"
    EN_ROUTE_TO_PICKUP = "EN_ROUTE_TO_PICKUP", "En route to pickup"
    LOADING = "LOADING", "Loading"
    IN_TRANSIT = "IN_TRANSIT", "In transit"
    UNLOADING = "UNLOADING", "Unloading"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"
    REJECTED = "REJECTED", "Rejected"
    EXCEPTION_REQUIRES_REVIEW = "EXCEPTION_REQUIRES_REVIEW", "Exception - requires review"


TERMINAL = {Status.COMPLETED, Status.CANCELLED, Status.REJECTED}
JOB_ACTIVE = {Status.EN_ROUTE_TO_PICKUP, Status.LOADING, Status.IN_TRANSIT, Status.UNLOADING}
SCHEDULED = {Status.CONFIRMED, Status.DRIVER_ASSIGNED, *JOB_ACTIVE, Status.EXCEPTION_REQUIRES_REVIEW}


def make_reference():
    return "KPM-" + secrets.token_hex(4).upper()


class Booking(TimeStamped):
    reference = models.CharField(max_length=20, unique=True, default=make_reference, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="bookings")
    service = models.ForeignKey("catalog.ServiceCategory", on_delete=models.PROTECT, related_name="bookings")
    property_type = models.CharField(max_length=10)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT, db_index=True)

    move_date = models.DateField(db_index=True)
    time_slot = models.CharField(max_length=30, blank=True)

    packing_required = models.BooleanField(default=False)
    loading_required = models.BooleanField(default=True)
    unloading_required = models.BooleanField(default=True)
    addons = models.JSONField(default=list, blank=True)
    vehicle_category = models.CharField(max_length=10, blank=True)
    distance_km = models.DecimalField(max_digits=7, decimal_places=1, null=True, blank=True)

    # Structured pickup / delivery address
    pickup_line1 = models.CharField(max_length=200)
    pickup_city = models.CharField(max_length=80, db_index=True)
    pickup_pincode = models.CharField(max_length=10, blank=True)
    pickup_floor = models.PositiveSmallIntegerField(default=0)
    pickup_elevator = models.BooleanField(default=True)
    pickup_parking = models.CharField(max_length=200, blank=True)
    drop_line1 = models.CharField(max_length=200)
    drop_city = models.CharField(max_length=80, db_index=True)
    drop_pincode = models.CharField(max_length=10, blank=True)
    drop_floor = models.PositiveSmallIntegerField(default=0)
    drop_elevator = models.BooleanField(default=True)
    drop_parking = models.CharField(max_length=200, blank=True)

    special_instructions = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)  # never serialized to customers/drivers

    driver = models.ForeignKey("accounts.DriverProfile", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="jobs")
    needs_manual_confirmation = models.BooleanField(default=False)

    cancelled_reason = models.CharField(max_length=255, blank=True)
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    late_cancellation = models.BooleanField(default=False)
    exception_reason = models.CharField(max_length=255, blank=True)

    submitted_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "move_date"]), models.Index(fields=["driver", "move_date"])]

    def status_was_scheduled(self, prev):
        return prev in SCHEDULED

    def __str__(self):
        return self.reference


class BookingInventoryItem(TimeStamped):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="inventory")
    item = models.ForeignKey("catalog.InventoryItem", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    name = models.CharField(max_length=100)
    room = models.CharField(max_length=40)
    quantity = models.PositiveSmallIntegerField(default=1)
    is_fragile = models.BooleanField(default=False)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["room", "name"]
        constraints = [models.CheckConstraint(condition=models.Q(quantity__gte=1), name="inventory_qty_gte_1")]


class Quotation(TimeStamped):
    class QStatus(models.TextChoices):
        SENT = "SENT", "Sent to customer"
        ACCEPTED = "ACCEPTED", "Accepted"
        SUPERSEDED = "SUPERSEDED", "Superseded"
        EXPIRED = "EXPIRED", "Expired"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="quotations")
    version = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=12, choices=QStatus.choices, default=QStatus.SENT, db_index=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_reason = models.CharField(max_length=200, blank=True)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    gst = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    valid_until = models.DateField()
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-version"]
        constraints = [
            models.UniqueConstraint(fields=["booking", "version"], name="uniq_quotation_version"),
            models.CheckConstraint(condition=models.Q(total__gte=0) & models.Q(discount__gte=0), name="quotation_amounts_gte_0"),
        ]

    @property
    def is_expired(self):
        return self.valid_until < timezone.localdate()


class QuotationLineItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="lines")
    code = models.CharField(max_length=30)
    label = models.CharField(max_length=160)
    quantity = models.DecimalField(max_digits=9, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]


class BookingStatusHistory(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="history")
    from_status = models.CharField(max_length=30, blank=True)
    to_status = models.CharField(max_length=30)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    actor_role = models.CharField(max_length=10, blank=True)
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at", "id"]


class DriverAssignment(TimeStamped):
    class AStatus(models.TextChoices):
        ASSIGNED = "ASSIGNED", "Assigned"
        ACKNOWLEDGED = "ACKNOWLEDGED", "Acknowledged"
        REPLACED = "REPLACED", "Replaced"
        COMPLETED = "COMPLETED", "Completed"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="assignments")
    driver = models.ForeignKey("accounts.DriverProfile", on_delete=models.PROTECT, related_name="assignments")
    status = models.CharField(max_length=14, choices=AStatus.choices, default=AStatus.ASSIGNED, db_index=True)
    team_notes = models.CharField(max_length=255, blank=True, help_text="Helpers / team members")
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class JobEvent(models.Model):
    class Kind(models.TextChoices):
        STATUS = "STATUS", "Status change"
        ARRIVED_PICKUP = "ARRIVED_PICKUP", "Arrived at pickup"
        LOADING_STARTED = "LOADING_STARTED", "Loading started"
        LOADING_DONE = "LOADING_DONE", "Loading completed"
        DEPARTED = "DEPARTED", "Departed"
        ARRIVED_DROP = "ARRIVED_DROP", "Arrived at destination"
        UNLOADING_STARTED = "UNLOADING_STARTED", "Unloading started"
        UNLOADING_DONE = "UNLOADING_DONE", "Unloading completed"
        DELAY = "DELAY", "Delay"
        ACCESS_PROBLEM = "ACCESS_PROBLEM", "Access problem"
        EXCEPTION = "EXCEPTION", "Exception"
        NOTE = "NOTE", "Note"
        PROOF = "PROOF", "Delivery proof"
        ACKNOWLEDGED = "ACKNOWLEDGED", "Assignment acknowledged"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="events")
    kind = models.CharField(max_length=24, choices=Kind.choices)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    note = models.CharField(max_length=500, blank=True)
    customer_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at", "id"]


class LocationPing(models.Model):
    """Consent-based driver location. Only stored for authorised active jobs; purged after retention window."""
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="pings")
    driver = models.ForeignKey("accounts.DriverProfile", on_delete=models.CASCADE, related_name="pings")
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    accuracy_m = models.PositiveIntegerField(null=True, blank=True)
    recorded_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-recorded_at"]
        constraints = [
            models.CheckConstraint(condition=models.Q(latitude__gte=-90, latitude__lte=90, longitude__gte=-180, longitude__lte=180),
                                   name="ping_valid_coords"),
        ]


class RescheduleRequest(TimeStamped):
    class RStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        DECLINED = "DECLINED", "Declined"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="reschedules")
    requested_date = models.DateField()
    requested_slot = models.CharField(max_length=30, blank=True)
    reason = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=RStatus.choices, default=RStatus.PENDING, db_index=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    decision_note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
