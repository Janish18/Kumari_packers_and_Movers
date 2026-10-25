from django.conf import settings
from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.audit import log_action
from apps.core.permissions import IsAdminRole

from .models import FAQ, BusinessConfiguration, InventoryItem, PricingRule, PropertyType, ServiceArea, ServiceCategory, SiteContent
from .pricing import calculate_estimate
from .serializers import (EstimateInputSerializer, FAQSerializer, InventoryItemSerializer, PricingRuleSerializer,
                          BusinessConfigSerializer, ServiceAreaSerializer, ServiceCategorySerializer, SiteContentSerializer)


class PublicList(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    model, serializer = None, None
    pagination_class = None

    def get_queryset(self):
        return self.model.objects.all()

    def get(self, request):
        return Response(self.serializer(self.get_queryset(), many=True).data)


class PublicServices(PublicList):
    model, serializer = ServiceCategory, ServiceCategorySerializer

    def get_queryset(self):
        return ServiceCategory.objects.filter(is_active=True)


class PublicAreas(PublicList):
    model, serializer = ServiceArea, ServiceAreaSerializer

    def get_queryset(self):
        qs = ServiceArea.objects.filter(is_active=True)
        q = self.request.query_params.get("q")
        return qs.filter(city__icontains=q) if q else qs


class PublicFAQs(PublicList):
    model, serializer = FAQ, FAQSerializer

    def get_queryset(self):
        return FAQ.objects.filter(is_published=True)


class PublicInventoryItems(PublicList):
    model, serializer = InventoryItem, InventoryItemSerializer

    def get_queryset(self):
        return InventoryItem.objects.filter(is_active=True)


class PublicSiteConfig(APIView):
    """Contact details, announcement, property types and integration readiness flags."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        cfg = {c.key: c.value for c in BusinessConfiguration.objects.filter(is_public=True)}
        content = {c.key: {"title": c.title, "body": c.body} for c in SiteContent.objects.filter(is_published=True)}
        biz = settings.BUSINESS
        return Response({
            "contact": {"phone": cfg.get("phone") or biz["phone"], "email": cfg.get("email") or biz["email"],
                        "address": cfg.get("address") or biz["address"]},
            "config": cfg,
            "content": content,
            "property_types": [{"value": v, "label": l} for v, l in PropertyType.choices],
            "integrations": {
                "payments": bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET),
                "maps": bool(settings.MAPS_PROVIDER and settings.MAPS_API_KEY),
                "sms": bool(settings.SMS_PROVIDER),
            },
        })


class EstimateView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "quote"

    def post(self, request):
        ser = EstimateInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        if d["property_type"] not in PropertyType.values:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"property_type": "Unknown property type."})
        res = calculate_estimate(**d)
        res["is_estimate"] = True
        res["disclaimer"] = "This is an estimate, not a confirmed quotation. The final price is confirmed after our team reviews your request."
        return Response(res)


class AuditedAdminViewSet(viewsets.ModelViewSet):
    """Base for admin CRUD that records create/update/delete in the audit log."""
    permission_classes = [IsAdminRole]
    audit_name = ""

    def perform_create(self, serializer):
        obj = serializer.save()
        log_action(self.request, f"{self.audit_name}_created", obj, str(obj)[:200])

    def perform_update(self, serializer):
        obj = serializer.save()
        log_action(self.request, f"{self.audit_name}_updated", obj, str(obj)[:200])

    def perform_destroy(self, instance):
        log_action(self.request, f"{self.audit_name}_deleted", instance, str(instance)[:200])
        instance.delete()


class AdminServiceViewSet(AuditedAdminViewSet):
    queryset, serializer_class, audit_name = ServiceCategory.objects.all(), ServiceCategorySerializer, "service"
    search_fields = ["name"]


class AdminAreaViewSet(AuditedAdminViewSet):
    queryset, serializer_class, audit_name = ServiceArea.objects.all(), ServiceAreaSerializer, "service_area"
    search_fields = ["city", "state"]


class AdminPricingViewSet(AuditedAdminViewSet):
    queryset, serializer_class, audit_name = PricingRule.objects.all(), PricingRuleSerializer, "pricing_rule"
    filterset_fields = ["rule_type", "is_active"]


class AdminFAQViewSet(AuditedAdminViewSet):
    queryset, serializer_class, audit_name = FAQ.objects.all(), FAQSerializer, "faq"


class AdminContentViewSet(AuditedAdminViewSet):
    queryset, serializer_class, audit_name = SiteContent.objects.all(), SiteContentSerializer, "site_content"


class AdminConfigViewSet(AuditedAdminViewSet):
    queryset, serializer_class, audit_name = BusinessConfiguration.objects.all(), BusinessConfigSerializer, "business_config"


class AdminInventoryItemViewSet(AuditedAdminViewSet):
    queryset, serializer_class, audit_name = InventoryItem.objects.all(), InventoryItemSerializer, "inventory_item"
    search_fields = ["name", "room"]
