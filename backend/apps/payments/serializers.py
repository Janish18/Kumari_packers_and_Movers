from rest_framework import serializers

from .models import Invoice, Payment, Refund


class RefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Refund
        fields = ["id", "amount", "reason", "status", "created_at"]


class PaymentSerializer(serializers.ModelSerializer):
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)
    customer_name = serializers.CharField(source="user.full_name", read_only=True)
    refunds = RefundSerializer(many=True, read_only=True)

    class Meta:
        model = Payment
        fields = ["id", "booking", "booking_reference", "customer_name", "kind", "amount", "currency", "status", "provider",
                  "provider_order_id", "provider_payment_id", "verified_at", "failure_reason", "created_at", "refunds"]


class InvoiceSerializer(serializers.ModelSerializer):
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)

    class Meta:
        model = Invoice
        fields = ["id", "number", "booking", "booking_reference", "subtotal", "discount", "tax", "total", "status", "created_at"]
