"""Seed *configuration* (services, pricing rules, FAQs, inventory master list, business config).

No customers, bookings, reviews or statistics are created. Prices below are PLACEHOLDER STARTING VALUES:
review and edit them in Admin > Pricing before quoting real customers.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.catalog.models import FAQ, BusinessConfiguration, InventoryItem, PricingRule, ServiceArea, ServiceCategory

SERVICES = [
    ("Local Household Shifting", "local-shifting", "truck", "Move within your city with trained handlers and a dedicated vehicle.", "Door-to-door household moves inside the city, covering loading, careful transport and unloading at your new home."),
    ("Intercity Relocation", "intercity-relocation", "route", "Plan a long-distance move with a transparent, itemised quote.", "Long-distance relocation between cities with route planning, a confirmed schedule and booking updates at each stage."),
    ("Office & Commercial Relocation", "office-relocation", "building", "Minimise downtime when moving your workplace.", "Workstations, files and equipment moved to a plan agreed in advance so your team is back at work quickly."),
    ("Packing & Unpacking", "packing-unpacking", "package", "Professional packing materials and careful unpacking.", "Items are wrapped and boxed by room, labelled clearly and unpacked at the destination on request."),
    ("Loading & Unloading", "loading-unloading", "forklift", "Labour-only support for loading and unloading.", "Trained helpers to load or unload your own vehicle or a vehicle you have arranged."),
    ("Furniture Dismantling & Reassembly", "furniture-assembly", "wrench", "Beds, wardrobes and modular furniture taken apart and rebuilt.", "Furniture is dismantled before transport, hardware is bagged and labelled, and everything is reassembled at the destination."),
    ("Fragile Item Handling", "fragile-handling", "shield", "Extra protection for glass, art, electronics and antiques.", "Fragile items receive additional padding and are loaded last and unloaded first."),
    ("Vehicle Transportation", "vehicle-transport", "car", "Transport your car or two-wheeler to your new city.", "Availability depends on route. Request a quote and we will confirm whether we can serve your route."),
    ("Storage & Warehousing", "storage", "warehouse", "Short-term storage between homes.", "Availability depends on location and capacity. Request a quote and we will confirm."),
]

PRICING = [  # (type, key, label, amount) - placeholders
    ("PROPERTY_BASE", "1RK", "1 RK / Studio", "3500"), ("PROPERTY_BASE", "1BHK", "1 BHK", "5500"), ("PROPERTY_BASE", "2BHK", "2 BHK", "8500"),
    ("PROPERTY_BASE", "3BHK", "3 BHK", "12500"), ("PROPERTY_BASE", "4BHK", "4 BHK+", "17000"), ("PROPERTY_BASE", "VILLA", "Villa", "22000"),
    ("PROPERTY_BASE", "OFFICE_S", "Small office", "9000"), ("PROPERTY_BASE", "OFFICE_L", "Large office", "26000"),
    ("LOADING", "1RK", "Labour", "800"), ("LOADING", "1BHK", "Labour", "1200"), ("LOADING", "2BHK", "Labour", "1800"), ("LOADING", "3BHK", "Labour", "2500"),
    ("LOADING", "4BHK", "Labour", "3200"), ("LOADING", "VILLA", "Labour", "4000"), ("LOADING", "OFFICE_S", "Labour", "2000"), ("LOADING", "OFFICE_L", "Labour", "5000"),
    ("PACKING", "1RK", "Packing", "1200"), ("PACKING", "1BHK", "Packing", "2000"), ("PACKING", "2BHK", "Packing", "3000"), ("PACKING", "3BHK", "Packing", "4200"),
    ("PACKING", "4BHK", "Packing", "5500"), ("PACKING", "VILLA", "Packing", "7000"), ("PACKING", "OFFICE_S", "Packing", "3000"), ("PACKING", "OFFICE_L", "Packing", "8000"),
    ("PER_KM", "default", "Distance charge per km", "22"), ("FLOOR", "default", "Per floor without elevator", "250"),
    ("VEHICLE", "MINI", "Mini truck", "0"), ("VEHICLE", "SMALL", "Small truck", "800"), ("VEHICLE", "MEDIUM", "Medium truck", "2000"), ("VEHICLE", "LARGE", "Large truck", "4000"),
    ("ADDON", "dismantling", "Furniture dismantling & reassembly", "1500"), ("ADDON", "fragile", "Fragile-item handling", "1000"), ("ADDON", "insurance_assist", "Transit protection handling", "800"),
]

FAQS = [
    ("Pricing", "How is my moving cost calculated?", "Your cost depends on property size, distance, packing and labour needs, floor access, vehicle type and optional services. The online calculator gives an estimate; the price becomes final only when you accept our itemised quotation."),
    ("Booking", "How do I book a move?", "Enter your requirements, request a quotation, review the itemised quote, accept it and we will confirm your booking and assign a driver."),
    ("Packing materials", "Do you provide packing materials?", "Yes, when you choose the packing service. Pricing is shown as a line item in your quotation."),
    ("Cancellation", "Can I cancel a booking?", "Yes. You can cancel from your dashboard. Cancelling close to the move date may incur a fee as described in our cancellation policy."),
    ("Rescheduling", "Can I change my move date?", "Yes. Request a new date from your booking page. Changes before confirmation apply immediately; after confirmation our team approves them based on availability."),
    ("Payment", "How do I pay?", "After accepting a quotation you can pay online from your dashboard when online payments are enabled, or contact support for other options."),
    ("Tracking", "Can I track my move?", "Yes. Your booking page shows verified status updates. Live location appears only when the driver has chosen to share it during an active job."),
    ("Damage reporting", "What if something is damaged or missing?", "Report it from your booking page once your move is completed. Add photos and a description and our team will investigate."),
    ("Refunds", "How do refunds work?", "Approved refunds are returned to your original payment method through our payment provider. You will be notified when a refund is initiated."),
]

ITEMS = {
    "Living Room": ["Sofa (3-seater)", "Sofa (2-seater)", "TV (up to 43 in)", "TV (above 43 in)", "TV unit", "Centre table", "Bookshelf", "Showcase / cabinet"],
    "Bedroom": ["Double bed", "Single bed", "Mattress", "Wardrobe", "Dressing table", "Bedside table", "Air conditioner"],
    "Kitchen": ["Refrigerator", "Washing machine", "Microwave", "Dining table", "Dining chair", "Gas stove", "Utensil boxes"],
    "Office": ["Desk", "Office chair", "Filing cabinet", "Computer / monitor", "Printer", "Conference table"],
    "Other": ["Cartons / boxes", "Bicycle", "Two-wheeler", "Plants", "Treadmill"],
}
FRAGILE = {"TV (up to 43 in)", "TV (above 43 in)", "Showcase / cabinet", "Computer / monitor", "Printer", "Plants", "Microwave"}


class Command(BaseCommand):
    help = "Seed default services, placeholder pricing, FAQs, inventory list and business configuration."

    def handle(self, *a, **o):
        for i, (name, slug, icon, summary, desc) in enumerate(SERVICES):
            ServiceCategory.objects.get_or_create(slug=slug, defaults=dict(name=name, icon=icon, summary=summary, description=desc, sort_order=i))
        for t, k, label, amt in PRICING:
            PricingRule.objects.get_or_create(rule_type=t, key=k, defaults=dict(label=label, amount=Decimal(amt)))
        for i, (cat, q, ans) in enumerate(FAQS):
            FAQ.objects.get_or_create(question=q, defaults=dict(category=cat, answer=ans, sort_order=i))
        for room, items in ITEMS.items():
            for n in items:
                InventoryItem.objects.get_or_create(room=room, name=n, defaults=dict(is_fragile=n in FRAGILE))
        cfg = {
            "gst_percent": (18, False), "advance_percent": (25, False), "quote_validity_days": (7, False),
            "free_cancellation_hours": (24, True), "daily_capacity": (10, False),
            "time_slots": (["08:00 - 11:00", "11:00 - 14:00", "14:00 - 17:00"], True),
            "announcement": ("", True), "phone": ("", True), "email": ("", True), "address": ("", True),
        }
        for k, (v, pub) in cfg.items():
            BusinessConfiguration.objects.get_or_create(key=k, defaults=dict(value=v, is_public=pub))
        self.stdout.write(self.style.SUCCESS("Defaults seeded. Review pricing and the GST percentage in the admin panel before quoting real customers."))
