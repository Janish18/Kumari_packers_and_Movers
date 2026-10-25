from rest_framework import serializers

from .models import FAQ, BusinessConfiguration, InventoryItem, PricingRule, ServiceArea, ServiceCategory, SiteContent


class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "slug", "summary", "description", "icon", "is_active", "sort_order"]


class ServiceAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceArea
        fields = ["id", "city", "state", "coverage", "is_active", "note"]


class PricingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingRule
        fields = ["id", "rule_type", "key", "label", "amount", "is_active"]


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = ["id", "category", "question", "answer", "sort_order", "is_published"]


class SiteContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteContent
        fields = ["id", "key", "title", "body", "is_published"]


class BusinessConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessConfiguration
        fields = ["id", "key", "value", "is_public"]


class InventoryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = ["id", "name", "room", "is_fragile", "is_active"]


class EstimateInputSerializer(serializers.Serializer):
    property_type = serializers.CharField()
    distance_km = serializers.DecimalField(max_digits=7, decimal_places=1, required=False, allow_null=True, min_value=0)
    packing = serializers.BooleanField(required=False, default=False)
    loading = serializers.BooleanField(required=False, default=True)
    unloading = serializers.BooleanField(required=False, default=True)
    pickup_floor = serializers.IntegerField(required=False, default=0, min_value=0, max_value=60)
    pickup_elevator = serializers.BooleanField(required=False, default=True)
    drop_floor = serializers.IntegerField(required=False, default=0, min_value=0, max_value=60)
    drop_elevator = serializers.BooleanField(required=False, default=True)
    vehicle_category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    addons = serializers.ListField(child=serializers.CharField(), required=False, default=list)
