from django.db import models

from apps.core.models import TimeStamped


class PropertyType(models.TextChoices):
    RK1 = "1RK", "1 RK / Studio"
    BHK1 = "1BHK", "1 BHK"
    BHK2 = "2BHK", "2 BHK"
    BHK3 = "3BHK", "3 BHK"
    BHK4 = "4BHK", "4 BHK+"
    VILLA = "VILLA", "Villa / Independent house"
    OFFICE_S = "OFFICE_S", "Small office"
    OFFICE_L = "OFFICE_L", "Large office"


class ServiceCategory(TimeStamped):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    summary = models.CharField(max_length=200)
    description = models.TextField()
    icon = models.CharField(max_length=40, default="truck")
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "service categories"

    def __str__(self):
        return self.name


class ServiceArea(TimeStamped):
    class Coverage(models.TextChoices):
        SERVICEABLE = "SERVICEABLE", "Serviceable"
        MANUAL = "MANUAL", "Requires manual confirmation"

    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80, blank=True)
    coverage = models.CharField(max_length=12, choices=Coverage.choices, default=Coverage.SERVICEABLE)
    is_active = models.BooleanField(default=True)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["city"]
        constraints = [models.UniqueConstraint(fields=["city", "state"], name="uniq_area_city_state")]

    def __str__(self):
        return f"{self.city}, {self.state}"


class PricingRule(TimeStamped):
    class RuleType(models.TextChoices):
        PROPERTY_BASE = "PROPERTY_BASE", "Base rate by property type"
        LOADING = "LOADING", "Loading & unloading labour by property type"
        PACKING = "PACKING", "Packing by property type"
        PER_KM = "PER_KM", "Distance charge per km"
        VEHICLE = "VEHICLE", "Vehicle category surcharge"
        FLOOR = "FLOOR", "Floor access (per floor, no elevator)"
        ADDON = "ADDON", "Optional service"

    rule_type = models.CharField(max_length=20, choices=RuleType.choices)
    key = models.CharField(max_length=40, help_text="Property type / vehicle category / add-on code / 'default'")
    label = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["rule_type", "key"]
        constraints = [
            models.UniqueConstraint(fields=["rule_type", "key"], name="uniq_pricing_rule"),
            models.CheckConstraint(condition=models.Q(amount__gte=0), name="pricing_amount_gte_0"),
        ]

    def __str__(self):
        return f"{self.rule_type}:{self.key}={self.amount}"


class FAQ(TimeStamped):
    category = models.CharField(max_length=40, default="General")
    question = models.CharField(max_length=250)
    answer = models.TextField()
    sort_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]


class SiteContent(TimeStamped):
    """Editable public content blocks: banners, about text, policies."""
    key = models.SlugField(unique=True)
    title = models.CharField(max_length=150)
    body = models.TextField(blank=True)
    is_published = models.BooleanField(default=True)


class BusinessConfiguration(TimeStamped):
    """Key/value settings editable by admins (contact info, GST, policy windows, slots, capacity)."""
    key = models.CharField(max_length=60, unique=True)
    value = models.JSONField(default=dict)
    is_public = models.BooleanField(default=False)

    @classmethod
    def get(cls, key, default=None):
        row = cls.objects.filter(key=key).first()
        return row.value if row else default


class InventoryItem(TimeStamped):
    """Master list of household items customers can pick from."""
    name = models.CharField(max_length=100)
    room = models.CharField(max_length=40, db_index=True)
    is_fragile = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["room", "name"]
        constraints = [models.UniqueConstraint(fields=["room", "name"], name="uniq_inventory_room_name")]
