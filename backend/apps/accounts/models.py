from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStamped


class Role(models.TextChoices):
    CUSTOMER = "CUSTOMER", "Customer"
    ADMIN = "ADMIN", "Administrator"
    DRIVER = "DRIVER", "Driver"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", Role.CUSTOMER)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(role=Role.ADMIN, is_staff=True, is_superuser=True)
        return self._create(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin, TimeStamped):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=120)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CUSTOMER, db_index=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)
    phone_verified = models.BooleanField(default=False)
    disabled_reason = models.CharField(max_length=255, blank=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"


class CustomerProfile(TimeStamped):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="customer_profile")
    terms_accepted_at = models.DateTimeField(default=timezone.now)
    notify_email = models.BooleanField(default=True)
    notify_sms = models.BooleanField(default=False)


class Vehicle(TimeStamped):
    CATEGORIES = [("MINI", "Mini truck"), ("SMALL", "Small truck"), ("MEDIUM", "Medium truck"), ("LARGE", "Large truck")]
    registration_no = models.CharField(max_length=20, unique=True)
    category = models.CharField(max_length=10, choices=CATEGORIES)
    capacity_cft = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.registration_no} ({self.category})"


class DriverProfile(TimeStamped):
    class Approval(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        SUSPENDED = "SUSPENDED", "Suspended"

    class Availability(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        BUSY = "BUSY", "On a job"
        OFF_DUTY = "OFF_DUTY", "Off duty"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="driver_profile")
    license_number = models.CharField(max_length=40, unique=True)
    license_expiry = models.DateField()
    approval = models.CharField(max_length=10, choices=Approval.choices, default=Approval.PENDING, db_index=True)
    availability = models.CharField(max_length=10, choices=Availability.choices, default=Availability.OFF_DUTY, db_index=True)
    vehicle = models.ForeignKey(Vehicle, null=True, blank=True, on_delete=models.SET_NULL, related_name="drivers")
    share_location = models.BooleanField(default=False)  # explicit consent for tracking
    notes = models.TextField(blank=True)

    @property
    def assignable(self):
        return (
            self.approval == self.Approval.APPROVED
            and self.user.is_active
            and self.availability == self.Availability.AVAILABLE
            and self.license_expiry >= timezone.localdate()
        )


class Address(TimeStamped):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=40, default="Home")
    line1 = models.CharField(max_length=200)
    line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80, blank=True)
    pincode = models.CharField(max_length=10, blank=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_default", "-created_at"]
