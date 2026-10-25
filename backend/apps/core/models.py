from django.conf import settings
from django.db import models


class TimeStamped(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs")
    action = models.CharField(max_length=80, db_index=True)
    entity_type = models.CharField(max_length=60, db_index=True)
    entity_id = models.CharField(max_length=60, blank=True)
    summary = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["entity_type", "entity_id"])]

    def __str__(self):
        return f"{self.action} {self.entity_type}#{self.entity_id}"


class UploadedFile(TimeStamped):
    """Metadata for uploaded files (item photos, delivery proof)."""
    PURPOSES = [("ITEM_PHOTO", "Item photo"), ("DELIVERY_PROOF", "Delivery proof"), ("DAMAGE", "Damage photo")]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="uploads")
    booking = models.ForeignKey("bookings.Booking", null=True, blank=True, on_delete=models.CASCADE, related_name="files")
    purpose = models.CharField(max_length=20, choices=PURPOSES)
    file = models.ImageField(upload_to="uploads/%Y/%m/")
    content_type = models.CharField(max_length=60)
    size_bytes = models.PositiveIntegerField()
    original_name = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-created_at"]
