from django.conf import settings
from django.db import models

from apps.core.models import TimeStamped


class Notification(TimeStamped):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=30, db_index=True)
    title = models.CharField(max_length=160)
    body = models.CharField(max_length=500, blank=True)
    booking = models.ForeignKey("bookings.Booking", null=True, blank=True, on_delete=models.CASCADE, related_name="+")
    is_read = models.BooleanField(default=False, db_index=True)
    email_status = models.CharField(max_length=12, blank=True)  # SENT / FAILED / SKIPPED

    class Meta:
        ordering = ["-created_at"]


class Review(TimeStamped):
    class RStatus(models.TextChoices):
        PENDING = "PENDING", "Pending moderation"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    booking = models.OneToOneField("bookings.Booking", on_delete=models.CASCADE, related_name="review")
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, max_length=1500)
    driver_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=RStatus.choices, default=RStatus.PENDING, db_index=True)
    admin_response = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.CheckConstraint(condition=models.Q(rating__gte=1, rating__lte=5), name="review_rating_1_5")]


class SupportTicket(TimeStamped):
    class TStatus(models.TextChoices):
        OPEN = "OPEN", "Open"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tickets")
    booking = models.ForeignKey("bookings.Booking", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets")
    subject = models.CharField(max_length=160)
    message = models.TextField(max_length=3000)
    status = models.CharField(max_length=12, choices=TStatus.choices, default=TStatus.OPEN, db_index=True)
    internal_notes = models.TextField(blank=True)
    resolution = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]


class DamageReport(TimeStamped):
    class Kind(models.TextChoices):
        DAMAGE = "DAMAGE", "Damaged item"
        MISSING = "MISSING", "Missing item"

    class DStatus(models.TextChoices):
        OPEN = "OPEN", "Open"
        INVESTIGATING = "INVESTIGATING", "Investigating"
        RESOLVED = "RESOLVED", "Resolved"
        REJECTED = "REJECTED", "Rejected"

    booking = models.ForeignKey("bookings.Booking", on_delete=models.CASCADE, related_name="damage_reports")
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="damage_reports")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    item_name = models.CharField(max_length=120)
    description = models.TextField(max_length=3000)
    estimated_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=14, choices=DStatus.choices, default=DStatus.OPEN, db_index=True)
    internal_notes = models.TextField(blank=True)
    resolution = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
