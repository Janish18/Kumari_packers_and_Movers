"""Quotation maths. Uses Decimal only. Never invents a price when a rule is not configured."""
from decimal import ROUND_HALF_UP, Decimal

from .models import BusinessConfiguration, PricingRule

TWO = Decimal("0.01")


def money(v):
    return Decimal(v).quantize(TWO, rounding=ROUND_HALF_UP)


def _rules():
    out = {}
    for r in PricingRule.objects.filter(is_active=True):
        out[(r.rule_type, r.key)] = r
    return out


def calculate_estimate(*, property_type, distance_km=None, packing=False, loading=True, unloading=True,
                       pickup_floor=0, pickup_elevator=True, drop_floor=0, drop_elevator=True,
                       vehicle_category=None, addons=None):
    """Return {configured, lines, subtotal, gst, total, notes}. Lines are dicts with Decimal amounts."""
    rules = _rules()
    notes, lines = [], []
    base = rules.get(("PROPERTY_BASE", property_type))
    if not base:
        return {"configured": False, "lines": [], "subtotal": None, "gst": None, "total": None,
                "notes": ["Pricing is not configured for this property type yet. Request a quotation and our team will price it manually."]}

    lines.append({"code": "BASE", "label": f"Base rate - {base.label}", "quantity": Decimal(1), "unit_price": base.amount})

    if packing:
        r = rules.get(("PACKING", property_type))
        if r:
            lines.append({"code": "PACKING", "label": "Packing & unpacking", "quantity": Decimal(1), "unit_price": r.amount})
        else:
            notes.append("Packing charges are not configured and will be confirmed in the quotation.")
    if loading or unloading:
        r = rules.get(("LOADING", property_type))
        if r:
            share = Decimal(1) if (loading and unloading) else Decimal("0.5")
            lines.append({"code": "LABOUR", "label": "Loading / unloading labour", "quantity": share, "unit_price": r.amount})
        else:
            notes.append("Labour charges are not configured and will be confirmed in the quotation.")

    if distance_km:
        r = rules.get(("PER_KM", "default"))
        if r:
            lines.append({"code": "DISTANCE", "label": f"Distance ({distance_km} km as entered)", "quantity": Decimal(str(distance_km)), "unit_price": r.amount})
        else:
            notes.append("Distance charge is not configured and will be confirmed in the quotation.")
    else:
        notes.append("Distance not provided: distance charges will be added when the route is confirmed.")

    floors = 0
    if not pickup_elevator:
        floors += max(int(pickup_floor or 0), 0)
    if not drop_elevator:
        floors += max(int(drop_floor or 0), 0)
    if floors:
        r = rules.get(("FLOOR", "default"))
        if r:
            lines.append({"code": "FLOOR", "label": "Floor access (no elevator)", "quantity": Decimal(floors), "unit_price": r.amount})
        else:
            notes.append("Floor-access charge is not configured.")

    if vehicle_category:
        r = rules.get(("VEHICLE", vehicle_category))
        if r:
            lines.append({"code": "VEHICLE", "label": f"Vehicle - {r.label}", "quantity": Decimal(1), "unit_price": r.amount})

    for code in addons or []:
        r = rules.get(("ADDON", code))
        if r:
            lines.append({"code": f"ADDON_{code}".upper(), "label": r.label, "quantity": Decimal(1), "unit_price": r.amount})
        else:
            notes.append(f"Add-on '{code}' is not priced yet.")

    for ln in lines:
        ln["line_total"] = money(ln["unit_price"] * ln["quantity"])
    subtotal = money(sum((ln["line_total"] for ln in lines), Decimal(0)))
    gst_pct = Decimal(str(BusinessConfiguration.get("gst_percent", 0) or 0))
    gst = money(subtotal * gst_pct / Decimal(100))
    return {"configured": True, "lines": lines, "subtotal": subtotal, "gst_percent": gst_pct,
            "gst": gst, "total": money(subtotal + gst), "notes": notes}
