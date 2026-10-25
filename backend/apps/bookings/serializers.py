from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import Role
from apps.catalog.models import BusinessConfiguration, InventoryItem, PropertyType, ServiceArea, ServiceCategory
from apps.payments.services import amount_due, paid_total

from .models import (Booking, BookingInventoryItem, BookingStatusHistory, DriverAssignment, JobEvent, JOB_ACTIVE, Quotation,
                     QuotationLineItem, RescheduleRequest, SCHEDULED, Status)
from .workflow import TRANSITIONS, transition


class InventoryLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingInventoryItem
        fields = ["id", "item", "name", "room", "quantity", "is_fragile", "notes"]
        read_only_fields = ["id"]
        extra_kwargs = {"item": {"required": False, "allow_null": True}}


class QuotationLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationLineItem
        fields = ["id", "code", "label", "quantity", "unit_price", "line_total"]


class QuotationSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True, read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    booking_reference = serializers.CharField(source="booking.reference", read_only=True)

    class Meta:
        model = Quotation
        fields = ["id", "booking", "booking_reference", "version", "status", "subtotal", "discount", "discount_reason",
                  "gst_percent", "gst", "total", "valid_until", "is_expired", "notes", "accepted_at", "created_at", "lines"]


class HistorySerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.full_name", default="System", read_only=True)

    class Meta:
        model = BookingStatusHistory
        fields = ["id", "from_status", "to_status", "actor_name", "actor_role", "reason", "created_at"]


class EventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.full_name", default="", read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = JobEvent
        fields = ["id", "kind", "kind_label", "note", "actor_name", "created_at"]


class RescheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RescheduleRequest
        fields = ["id", "requested_date", "requested_slot", "reason", "status", "decision_note", "created_at"]


class BookingInputSerializer(serializers.Serializer):
    """Create / edit payload for customers."""
    service = serializers.PrimaryKeyRelatedField(queryset=ServiceCategory.objects.filter(is_active=True))
    property_type = serializers.ChoiceField(choices=PropertyType.choices)
    move_date = serializers.DateField()
    time_slot = serializers.CharField(required=False, allow_blank=True, max_length=30)
    packing_required = serializers.BooleanField(required=False, default=False)
    loading_required = serializers.BooleanField(required=False, default=True)
    unloading_required = serializers.BooleanField(required=False, default=True)
    addons = serializers.ListField(child=serializers.CharField(max_length=40), required=False, default=list)
    distance_km = serializers.DecimalField(max_digits=7, decimal_places=1, required=False, allow_null=True, min_value=0)
    pickup_line1 = serializers.CharField(max_length=200)
    pickup_city = serializers.CharField(max_length=80)
    pickup_pincode = serializers.CharField(max_length=10, required=False, allow_blank=True)
    pickup_floor = serializers.IntegerField(min_value=0, max_value=60, required=False, default=0)
    pickup_elevator = serializers.BooleanField(required=False, default=True)
    pickup_parking = serializers.CharField(max_length=200, required=False, allow_blank=True)
    drop_line1 = serializers.CharField(max_length=200)
    drop_city = serializers.CharField(max_length=80)
    drop_pincode = serializers.CharField(max_length=10, required=False, allow_blank=True)
    drop_floor = serializers.IntegerField(min_value=0, max_value=60, required=False, default=0)
    drop_elevator = serializers.BooleanField(required=False, default=True)
    drop_parking = serializers.CharField(max_length=200, required=False, allow_blank=True)
    special_instructions = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    inventory = InventoryLineSerializer(many=True, required=False)
    submit = serializers.BooleanField(required=False, default=False, write_only=True)

    def validate_move_date(self, v):
        if v < timezone.localdate():
            raise serializers.ValidationError("Move date cannot be in the past.")
        if v > timezone.localdate() + timedelta(days=365):
            raise serializers.ValidationError("Move date must be within the next 12 months.")
        return v

    def validate_time_slot(self, v):
        slots = BusinessConfiguration.get("time_slots")
        if v and slots and v not in slots:
            raise serializers.ValidationError("Choose one of the available time slots.")
        return v

    def _manual_flag(self, data):
        def ok(city):
            return ServiceArea.objects.filter(is_active=True, coverage=ServiceArea.Coverage.SERVICEABLE, city__iexact=city.strip()).exists()
        return not (ok(data["pickup_city"]) and ok(data["drop_city"]))

    @transaction.atomic
    def create(self, data):
        request = self.context["request"]
        inv = data.pop("inventory", [])
        submit = data.pop("submit", False)
        b = Booking.objects.create(customer=request.user, needs_manual_confirmation=self._manual_flag(data), **data)
        self._save_inventory(b, inv)
        BookingStatusHistory.objects.create(booking=b, from_status="", to_status=Status.DRAFT, actor=request.user,
                                            actor_role=Role.CUSTOMER, reason="Booking created")
        if submit:
            b = transition(b.pk, Status.QUOTE_REQUESTED, request.user, request=request)
        return b

    @transaction.atomic
    def update(self, b, data):
        if b.status != Status.DRAFT:
            raise serializers.ValidationError("Only draft bookings can be edited. Use reschedule or cancel instead.")
        inv = data.pop("inventory", None)
        submit = data.pop("submit", False)
        for k, v in data.items():
            setattr(b, k, v)
        b.needs_manual_confirmation = self._manual_flag({"pickup_city": b.pickup_city, "drop_city": b.drop_city})
        b.save()
        if inv is not None:
            b.inventory.all().delete()
            self._save_inventory(b, inv)
        if submit:
            b = transition(b.pk, Status.QUOTE_REQUESTED, self.context["request"].user, request=self.context["request"])
        return b

    @staticmethod
    def _save_inventory(b, rows):
        BookingInventoryItem.objects.bulk_create([
            BookingInventoryItem(booking=b, item=r.get("item"), name=r["name"], room=r["room"], quantity=r.get("quantity", 1),
                                 is_fragile=r.get("is_fragile", False), notes=r.get("notes", "")) for r in rows])


class BookingBase(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    property_label = serializers.SerializerMethodField()

    def get_property_label(self, b):
        return dict(PropertyType.choices).get(b.property_type, b.property_type)


class BookingListSerializer(BookingBase):
    total = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = ["id", "reference", "status", "status_label", "service_name", "property_type", "property_label", "move_date",
                  "time_slot", "pickup_city", "drop_city", "total", "created_at"]

    def get_total(self, b):
        q = b.quotations.exclude(status__in=[Quotation.QStatus.SUPERSEDED]).first()
        return q.total if q else None


class BookingDetailSerializer(BookingBase):
    inventory = InventoryLineSerializer(many=True, read_only=True)
    quotations = serializers.SerializerMethodField()
    driver_info = serializers.SerializerMethodField()
    payment_summary = serializers.SerializerMethodField()
    history = HistorySerializer(many=True, read_only=True)
    pending_reschedule = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()
    invoice_id = serializers.SerializerMethodField()
    has_review = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        exclude = ["internal_notes", "customer", "driver", "cancelled_by", "is_archived"]

    def get_quotations(self, b):
        return QuotationSerializer(b.quotations.all(), many=True).data

    def get_driver_info(self, b):
        if not b.driver_id or b.status not in SCHEDULED | {Status.COMPLETED}:
            return None
        a = b.assignments.exclude(status=DriverAssignment.AStatus.REPLACED).first()
        d = b.driver
        return {"name": d.user.full_name, "phone": d.user.phone, "vehicle": d.vehicle.registration_no if d.vehicle else "",
                "vehicle_category": d.vehicle.get_category_display() if d.vehicle else "", "team": a.team_notes if a else ""}

    def get_payment_summary(self, b):
        due = amount_due(b)
        return {"paid": paid_total(b), "due": due, "payments": [
            {"id": p.id, "kind": p.kind, "amount": p.amount, "status": p.status, "created_at": p.created_at} for p in b.payments.all()[:20]]}

    def get_pending_reschedule(self, b):
        r = b.reschedules.filter(status="PENDING").first()
        return RescheduleSerializer(r).data if r else None

    def get_invoice_id(self, b):
        inv = getattr(b, "invoice", None)
        return inv.id if inv else None

    def get_has_review(self, b):
        return hasattr(b, "review")

    def get_actions(self, b):
        from apps.payments.services import accepted_quotation
        latest = b.quotations.filter(status=Quotation.QStatus.SENT).first()
        nxt = TRANSITIONS[Status(b.status)]
        due = amount_due(b)
        return {
            "can_edit": b.status == Status.DRAFT,
            "can_submit": b.status == Status.DRAFT,
            "can_accept_quote": b.status == Status.QUOTE_PREPARED and bool(latest) and not latest.is_expired,
            "can_cancel": Status.CANCELLED in nxt and Role.CUSTOMER in nxt[Status.CANCELLED],
            "can_reschedule": b.status in (Status.QUOTE_REQUESTED, Status.QUOTE_PREPARED, Status.QUOTE_ACCEPTED, Status.CONFIRMED, Status.DRIVER_ASSIGNED),
            "can_pay": bool(accepted_quotation(b)) and bool(due) and b.status not in (Status.CANCELLED, Status.REJECTED),
            "can_review": b.status == Status.COMPLETED and not hasattr(b, "review"),
            "can_report_damage": b.status in (Status.COMPLETED, Status.UNLOADING),
            "can_track": b.status in SCHEDULED or b.status == Status.COMPLETED,
        }


class AdminBookingSerializer(BookingDetailSerializer):
    customer_info = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()
    assignments = serializers.SerializerMethodField()
    events = EventSerializer(many=True, read_only=True)
    reschedules = RescheduleSerializer(many=True, read_only=True)
    driver_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Booking
        exclude = ["customer", "driver", "cancelled_by"]

    def get_customer_info(self, b):
        c = b.customer
        return {"id": c.id, "name": c.full_name, "email": c.email, "phone": c.phone}

    def get_allowed_transitions(self, b):
        return [{"value": s, "label": Status(s).label} for s in TRANSITIONS[Status(b.status)] if Role.ADMIN in TRANSITIONS[Status(b.status)][s]]

    def get_assignments(self, b):
        return [{"id": a.id, "driver": a.driver.user.full_name, "status": a.status, "team_notes": a.team_notes, "created_at": a.created_at,
                 "ended_at": a.ended_at} for a in b.assignments.select_related("driver__user")]

    def get_driver_info(self, b):
        if not b.driver_id:
            return None
        d = b.driver
        return {"id": d.id, "name": d.user.full_name, "phone": d.user.phone, "vehicle": d.vehicle.registration_no if d.vehicle else ""}


class AdminBookingListSerializer(BookingListSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    driver_name = serializers.CharField(source="driver.user.full_name", default=None, read_only=True)

    class Meta(BookingListSerializer.Meta):
        fields = BookingListSerializer.Meta.fields + ["customer_name", "driver_name", "needs_manual_confirmation"]


class DriverJobSerializer(BookingBase):
    inventory = InventoryLineSerializer(many=True, read_only=True)
    customer_contact = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()
    allowed_next = serializers.SerializerMethodField()
    acknowledged = serializers.SerializerMethodField()
    proof_count = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = ["id", "reference", "status", "status_label", "service_name", "property_type", "property_label", "move_date",
                  "time_slot", "packing_required", "loading_required", "unloading_required", "addons", "pickup_line1",
                  "pickup_city", "pickup_pincode", "pickup_floor", "pickup_elevator", "pickup_parking", "drop_line1",
                  "drop_city", "drop_pincode", "drop_floor", "drop_elevator", "drop_parking", "special_instructions",
                  "inventory", "customer_contact", "events", "allowed_next", "acknowledged", "proof_count"]

    def get_customer_contact(self, b):  # only while the job is live
        if b.status in SCHEDULED:
            return {"name": b.customer.full_name, "phone": b.customer.phone}
        return None

    def get_events(self, b):
        return EventSerializer(b.events.all(), many=True).data

    def get_allowed_next(self, b):
        return [{"value": s, "label": Status(s).label} for s, roles in TRANSITIONS[Status(b.status)].items() if Role.DRIVER in roles]

    def get_acknowledged(self, b):
        return b.assignments.filter(status=DriverAssignment.AStatus.ACKNOWLEDGED).exists()

    def get_proof_count(self, b):
        return b.files.filter(purpose="DELIVERY_PROOF").count()
