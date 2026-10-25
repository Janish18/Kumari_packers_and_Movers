from rest_framework import serializers

from .models import DamageReport, Notification, Review, SupportTicket


class NotificationSerializer(serializers.ModelSerializer):
    booking_reference = serializers.CharField(source="booking.reference", default=None, read_only=True)

    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "body", "booking", "booking_reference", "is_read", "created_at"]
        read_only_fields = ["id", "kind", "title", "body", "booking", "created_at"]


class ReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["id", "booking", "rating", "comment", "driver_rating", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate(self, a):
        user = self.context["request"].user
        b = a["booking"]
        if b.customer_id != user.id:
            raise serializers.ValidationError({"booking": "Booking not found."})
        if b.status != "COMPLETED":
            raise serializers.ValidationError({"booking": "You can review a booking after it is completed."})
        if hasattr(b, "review"):
            raise serializers.ValidationError({"booking": "You have already reviewed this booking."})
        for k in ("rating", "driver_rating"):
            if a.get(k) is not None and not 1 <= a[k] <= 5:
                raise serializers.ValidationError({k: "Rating must be between 1 and 5."})
        return a


class PublicReviewSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "rating", "comment", "author", "admin_response", "created_at"]

    def get_author(self, r):  # first name + initial only
        parts = r.customer.full_name.split()
        return parts[0] + (f" {parts[-1][0]}." if len(parts) > 1 else "")


class AdminReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "booking_reference", "customer_name", "rating", "driver_rating", "comment", "status", "admin_response", "created_at"]
        read_only_fields = ["rating", "driver_rating", "comment", "created_at"]


class TicketSerializer(serializers.ModelSerializer):
    booking_reference = serializers.CharField(source="booking.reference", default=None, read_only=True)

    class Meta:
        model = SupportTicket
        fields = ["id", "booking", "booking_reference", "subject", "message", "status", "resolution", "created_at", "updated_at"]
        read_only_fields = ["id", "status", "resolution", "created_at", "updated_at"]

    def validate_booking(self, b):
        if b and b.customer_id != self.context["request"].user.id:
            raise serializers.ValidationError("Booking not found.")
        return b


class AdminTicketSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="user.full_name", read_only=True)
    customer_email = serializers.CharField(source="user.email", read_only=True)
    booking_reference = serializers.CharField(source="booking.reference", default=None, read_only=True)

    class Meta:
        model = SupportTicket
        fields = ["id", "customer_name", "customer_email", "booking_reference", "subject", "message", "status", "internal_notes", "resolution", "created_at"]
        read_only_fields = ["subject", "message", "created_at"]


class DamageReportSerializer(serializers.ModelSerializer):
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)

    class Meta:
        model = DamageReport
        fields = ["id", "booking", "booking_reference", "kind", "item_name", "description", "estimated_value", "status", "resolution", "created_at"]
        read_only_fields = ["id", "status", "resolution", "created_at"]

    def validate_booking(self, b):
        if b.customer_id != self.context["request"].user.id:
            raise serializers.ValidationError("Booking not found.")
        if b.status not in ("COMPLETED", "UNLOADING"):
            raise serializers.ValidationError("Damage can be reported once unloading has started or the job is completed.")
        return b


class AdminDamageSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="reporter.full_name", read_only=True)
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)

    class Meta:
        model = DamageReport
        fields = ["id", "booking_reference", "customer_name", "kind", "item_name", "description", "estimated_value", "status",
                  "internal_notes", "resolution", "created_at"]
        read_only_fields = ["kind", "item_name", "description", "estimated_value", "created_at"]
