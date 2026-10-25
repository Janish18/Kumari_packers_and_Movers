import re

from django.contrib.auth import password_validation
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import Address, CustomerProfile, DriverProfile, Role, User, Vehicle

PHONE_RE = re.compile(r"^\+?\d{10,14}$")


def normalize_phone(value):
    v = re.sub(r"[\s\-()]", "", value or "")
    if not PHONE_RE.match(v):
        raise serializers.ValidationError("Enter a valid phone number (10-14 digits).")
    return v


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "phone", "full_name", "role", "email_verified", "phone_verified", "created_at"]
        read_only_fields = fields


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["full_name", "phone"]

    def validate_phone(self, v):
        v = normalize_phone(v)
        if User.objects.filter(phone=v).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("This phone number is already in use.")
        return v


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    confirm_password = serializers.CharField(write_only=True)
    accept_terms = serializers.BooleanField()
    address_line1 = serializers.CharField(required=False, allow_blank=True, max_length=200)
    city = serializers.CharField(required=False, allow_blank=True, max_length=80)
    pincode = serializers.CharField(required=False, allow_blank=True, max_length=10)

    def validate_email(self, v):
        v = v.lower()
        if User.objects.filter(email=v).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return v

    def validate_phone(self, v):
        v = normalize_phone(v)
        if User.objects.filter(phone=v).exists():
            raise serializers.ValidationError("An account with this phone number already exists.")
        return v

    def validate_accept_terms(self, v):
        if not v:
            raise serializers.ValidationError("You must accept the terms to register.")
        return v

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        probe = User(email=attrs["email"], full_name=attrs["full_name"], phone=attrs["phone"])
        try:
            password_validation.validate_password(attrs["password"], probe)
        except Exception as exc:  # DjangoValidationError
            raise serializers.ValidationError({"password": list(getattr(exc, "messages", [str(exc)]))})
        return attrs

    @transaction.atomic
    def create(self, data):
        user = User.objects.create_user(
            email=data["email"], password=data["password"], full_name=data["full_name"],
            phone=data["phone"], role=Role.CUSTOMER,  # role is NEVER taken from client input
        )
        CustomerProfile.objects.create(user=user, terms_accepted_at=timezone.now())
        if data.get("address_line1") and data.get("city"):
            Address.objects.create(user=user, line1=data["address_line1"], city=data["city"],
                                   pincode=data.get("pincode", ""), is_default=True)
        return user


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)
    remember_me = serializers.BooleanField(required=False, default=False)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        try:
            password_validation.validate_password(attrs["new_password"], user)
        except Exception as exc:
            raise serializers.ValidationError({"new_password": list(getattr(exc, "messages", [str(exc)]))})
        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "label", "line1", "line2", "city", "state", "pincode", "is_default"]

    def create(self, data):
        user = self.context["request"].user
        if data.get("is_default"):
            user.addresses.update(is_default=False)
        return Address.objects.create(user=user, **data)

    def update(self, inst, data):
        if data.get("is_default"):
            inst.user.addresses.exclude(pk=inst.pk).update(is_default=False)
        return super().update(inst, data)


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ["id", "registration_no", "category", "capacity_cft", "is_active"]


class DriverAdminSerializer(serializers.ModelSerializer):
    """Admin view/edit of a driver: user + profile in one payload."""
    id = serializers.IntegerField(source="user.id", read_only=True)
    profile_id = serializers.IntegerField(source="pk", read_only=True)
    full_name = serializers.CharField(source="user.full_name")
    email = serializers.EmailField(source="user.email")
    phone = serializers.CharField(source="user.phone")
    is_active = serializers.BooleanField(source="user.is_active", required=False)
    password = serializers.CharField(write_only=True, required=False)
    vehicle_detail = VehicleSerializer(source="vehicle", read_only=True)

    class Meta:
        model = DriverProfile
        fields = ["id", "profile_id", "full_name", "email", "phone", "is_active", "password", "license_number",
                  "license_expiry", "approval", "availability", "vehicle", "vehicle_detail", "notes"]

    def validate_phone(self, v):
        return normalize_phone(v)

    def _check_unique(self, user_data, instance=None):
        qs = User.objects.all()
        if instance:
            qs = qs.exclude(pk=instance.user.pk)
        if "email" in user_data and qs.filter(email=user_data["email"].lower()).exists():
            raise serializers.ValidationError({"email": "Email already in use."})
        if "phone" in user_data and qs.filter(phone=user_data["phone"]).exists():
            raise serializers.ValidationError({"phone": "Phone already in use."})

    @transaction.atomic
    def create(self, data):
        user_data = data.pop("user")
        pw = data.pop("password", None)
        if not pw:
            raise serializers.ValidationError({"password": "A password is required for new drivers."})
        self._check_unique(user_data)
        try:
            password_validation.validate_password(pw)
        except Exception as exc:
            raise serializers.ValidationError({"password": list(getattr(exc, "messages", [str(exc)]))})
        user = User.objects.create_user(email=user_data["email"], password=pw, full_name=user_data["full_name"],
                                        phone=user_data["phone"], role=Role.DRIVER,
                                        is_active=user_data.get("is_active", True))
        return DriverProfile.objects.create(user=user, **data)

    @transaction.atomic
    def update(self, inst, data):
        user_data = data.pop("user", {})
        pw = data.pop("password", None)
        self._check_unique(user_data, inst)
        u = inst.user
        for k, v in user_data.items():
            setattr(u, k, v.lower() if k == "email" else v)
        if pw:
            password_validation.validate_password(pw, u)
            u.set_password(pw)
        u.save()
        return super().update(inst, data)


class CustomerAdminSerializer(serializers.ModelSerializer):
    bookings_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "phone", "full_name", "is_active", "disabled_reason", "created_at", "bookings_count"]
        read_only_fields = ["id", "email", "phone", "full_name", "created_at", "bookings_count"]
