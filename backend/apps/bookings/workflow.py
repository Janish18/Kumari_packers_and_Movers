"""Server-side booking state machine. Every status change MUST go through `transition()`."""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from apps.accounts.models import DriverProfile, Role
from apps.catalog.models import BusinessConfiguration
from apps.core.audit import log_action

from .models import Booking, BookingStatusHistory, DriverAssignment, JobEvent, SCHEDULED, Status

C, A, D = Role.CUSTOMER, Role.ADMIN, Role.DRIVER
S = Status


class Conflict(APIException):
    status_code = 409
    default_detail = "This action conflicts with the current state of the booking."
    default_code = "conflict"


# from_status -> {to_status: roles allowed}
TRANSITIONS = {
    S.DRAFT: {S.QUOTE_REQUESTED: {C}, S.CANCELLED: {C, A}},
    S.QUOTE_REQUESTED: {S.QUOTE_PREPARED: {A}, S.REJECTED: {A}, S.CANCELLED: {C, A}},
    S.QUOTE_PREPARED: {S.QUOTE_ACCEPTED: {C}, S.REJECTED: {A}, S.CANCELLED: {C, A}},
    S.QUOTE_ACCEPTED: {S.CONFIRMED: {A}, S.REJECTED: {A}, S.CANCELLED: {C, A}},
    S.CONFIRMED: {S.DRIVER_ASSIGNED: {A}, S.CANCELLED: {C, A}},
    S.DRIVER_ASSIGNED: {S.EN_ROUTE_TO_PICKUP: {D, A}, S.CONFIRMED: {A}, S.CANCELLED: {C, A},
                        S.EXCEPTION_REQUIRES_REVIEW: {D, A}},
    S.EN_ROUTE_TO_PICKUP: {S.LOADING: {D, A}, S.EXCEPTION_REQUIRES_REVIEW: {D, A}, S.CANCELLED: {A}},
    S.LOADING: {S.IN_TRANSIT: {D, A}, S.EXCEPTION_REQUIRES_REVIEW: {D, A}, S.CANCELLED: {A}},
    S.IN_TRANSIT: {S.UNLOADING: {D, A}, S.EXCEPTION_REQUIRES_REVIEW: {D, A}},
    S.UNLOADING: {S.COMPLETED: {D, A}, S.EXCEPTION_REQUIRES_REVIEW: {D, A}},
    S.EXCEPTION_REQUIRES_REVIEW: {S.DRIVER_ASSIGNED: {A}, S.EN_ROUTE_TO_PICKUP: {A}, S.LOADING: {A}, S.IN_TRANSIT: {A},
                                  S.UNLOADING: {A}, S.COMPLETED: {A}, S.CANCELLED: {A}},
    S.COMPLETED: {}, S.CANCELLED: {}, S.REJECTED: {},
}
REASON_REQUIRED = {S.CANCELLED, S.REJECTED, S.EXCEPTION_REQUIRES_REVIEW}
NOTIFY_CUSTOMER = {S.QUOTE_PREPARED, S.CONFIRMED, S.DRIVER_ASSIGNED, S.EN_ROUTE_TO_PICKUP, S.LOADING, S.IN_TRANSIT,
                   S.UNLOADING, S.COMPLETED, S.CANCELLED, S.REJECTED, S.EXCEPTION_REQUIRES_REVIEW}
EVENT_FOR = {S.EN_ROUTE_TO_PICKUP: JobEvent.Kind.STATUS, S.LOADING: JobEvent.Kind.LOADING_STARTED,
             S.IN_TRANSIT: JobEvent.Kind.DEPARTED, S.UNLOADING: JobEvent.Kind.UNLOADING_STARTED,
             S.COMPLETED: JobEvent.Kind.UNLOADING_DONE}


def allowed_next(booking, role):
    return [to for to, roles in TRANSITIONS[booking.status].items() if role in roles]


def check_capacity(booking):
    cap = BusinessConfiguration.get("daily_capacity", 10)
    try:
        cap = int(cap)
    except (TypeError, ValueError):
        cap = 10
    used = (Booking.objects.filter(move_date=booking.move_date, status__in=[S.CONFIRMED, S.DRIVER_ASSIGNED,
            S.EN_ROUTE_TO_PICKUP, S.LOADING, S.IN_TRANSIT, S.UNLOADING]).exclude(pk=booking.pk).count())
    if used >= cap:
        raise Conflict("Daily capacity for this date has been reached. Reschedule the booking or raise the capacity setting.")


@transaction.atomic
def transition(booking_id, to_status, actor, *, reason="", request=None, expected_status=None, driver_scope=None):
    """Validate and apply a status change atomically. Returns the updated booking.

    `expected_status` lets clients detect stale views (409). `driver_scope` is the DriverProfile a driver acts as.
    """
    booking = Booking.objects.select_for_update().get(pk=booking_id)
    role = actor.role
    to_status = S(to_status)

    if expected_status and booking.status != expected_status:
        raise Conflict("This booking was updated by someone else. Refresh and try again.")
    if booking.status == to_status:
        raise Conflict("The booking is already in that status.")
    allowed = TRANSITIONS[S(booking.status)].get(to_status)
    if allowed is None:
        raise ValidationError({"status": f"Cannot move from {booking.get_status_display()} to {to_status.label}."})
    if role not in allowed:
        raise PermissionDenied("Your role is not permitted to make this change.")
    if role == C and booking.customer_id != actor.id:
        raise PermissionDenied("You do not have access to this booking.")
    if role == D and (not driver_scope or booking.driver_id != driver_scope.id):
        raise PermissionDenied("This job is not assigned to you.")
    if to_status in REASON_REQUIRED and not reason.strip():
        raise ValidationError({"reason": "A reason is required for this change."})

    now = timezone.now()
    prev = booking.status
    if to_status == S.CONFIRMED and prev != S.DRIVER_ASSIGNED:
        check_capacity(booking)
    if to_status == S.DRIVER_ASSIGNED and not booking.driver_id:
        raise ValidationError({"status": "Assign a driver using the assign-driver action."})

    booking.status = to_status
    if to_status == S.QUOTE_REQUESTED:
        booking.submitted_at = now
    elif to_status == S.CONFIRMED:
        booking.confirmed_at = booking.confirmed_at or now
        if prev == S.DRIVER_ASSIGNED:  # un-assign
            _release_driver(booking, now)
    elif to_status == S.EN_ROUTE_TO_PICKUP:
        booking.started_at = booking.started_at or now
    elif to_status == S.COMPLETED:
        booking.completed_at = now
    elif to_status in (S.CANCELLED, S.REJECTED):
        booking.cancelled_at = now
        booking.cancelled_reason = reason[:255]
        booking.cancelled_by = actor
        if to_status == S.CANCELLED and role == C:
            hrs = BusinessConfiguration.get("free_cancellation_hours", 24)
            try:
                hrs = int(hrs)
            except (TypeError, ValueError):
                hrs = 24
            from datetime import datetime, time, timedelta
            start = timezone.make_aware(datetime.combine(booking.move_date, time(8, 0)))
            booking.late_cancellation = booking.status_was_scheduled(prev) and (start - now) < timedelta(hours=hrs)
        _release_driver(booking, now)
    elif to_status == S.EXCEPTION_REQUIRES_REVIEW:
        booking.exception_reason = reason[:255]
    booking.save()

    if to_status == S.COMPLETED and booking.driver_id:
        DriverAssignment.objects.filter(booking=booking).exclude(status=DriverAssignment.AStatus.REPLACED).update(
            status=DriverAssignment.AStatus.COMPLETED, ended_at=now)
        DriverProfile.objects.filter(pk=booking.driver_id).update(availability=DriverProfile.Availability.AVAILABLE)
    elif to_status == S.EN_ROUTE_TO_PICKUP and booking.driver_id:
        DriverProfile.objects.filter(pk=booking.driver_id).update(availability=DriverProfile.Availability.BUSY)

    BookingStatusHistory.objects.create(booking=booking, from_status=prev, to_status=to_status, actor=actor,
                                        actor_role=role, reason=reason[:255])
    kind = EVENT_FOR.get(to_status)
    if kind and role in (D, A):
        JobEvent.objects.create(booking=booking, kind=kind, actor=actor, note=f"Status: {to_status.label}")
    if role == A or to_status in (S.CANCELLED,):
        log_action(request, "booking_status_changed", booking, f"{booking.reference}: {prev} -> {to_status}",
                   {"from": prev, "to": to_status, "reason": reason}, actor=actor)

    if to_status in NOTIFY_CUSTOMER and actor.id != booking.customer_id:
        from apps.support.notify import notify
        notify(booking.customer, "BOOKING_STATUS", f"Booking {booking.reference}: {to_status.label}",
               reason or f"Your booking is now '{to_status.label}'.", booking=booking)
    elif to_status == S.QUOTE_REQUESTED:
        from apps.support.notify import notify
        notify(booking.customer, "BOOKING_CONFIRMATION", f"Quote request received ({booking.reference})",
               "We have received your request. Our team will prepare a quotation shortly.", booking=booking)
    return booking


def _release_driver(booking, now):
    if booking.driver_id:
        DriverAssignment.objects.filter(booking=booking, status__in=[DriverAssignment.AStatus.ASSIGNED,
                                        DriverAssignment.AStatus.ACKNOWLEDGED]).update(
            status=DriverAssignment.AStatus.REPLACED, ended_at=now)
        DriverProfile.objects.filter(pk=booking.driver_id).update(availability=DriverProfile.Availability.AVAILABLE)
        booking.driver = None


@transaction.atomic
def assign_driver(booking_id, driver_id, actor, *, team_notes="", request=None):
    """Assign (or reassign) an approved, available driver. Prevents double-booking on the same date."""
    booking = Booking.objects.select_for_update().get(pk=booking_id)
    if booking.status not in (S.CONFIRMED, S.DRIVER_ASSIGNED):
        raise ValidationError({"driver": "Drivers can only be assigned to confirmed bookings."})
    try:
        driver = DriverProfile.objects.select_for_update().select_related("user").get(pk=driver_id)
    except DriverProfile.DoesNotExist:
        raise ValidationError({"driver": "Driver not found."})
    if booking.driver_id == driver.id:
        raise Conflict("This driver is already assigned to the booking.")
    if driver.approval != DriverProfile.Approval.APPROVED or not driver.user.is_active:
        raise ValidationError({"driver": "Driver is not approved or is disabled."})
    if driver.license_expiry < timezone.localdate():
        raise ValidationError({"driver": "Driver's licence has expired."})
    if driver.availability == DriverProfile.Availability.OFF_DUTY:
        raise ValidationError({"driver": "Driver is off duty."})
    clash = Booking.objects.filter(driver=driver, move_date=booking.move_date, status__in=SCHEDULED).exclude(pk=booking.pk)
    if clash.exists():
        raise Conflict("Driver already has a job on this date.")

    now = timezone.now()
    previous = booking.driver
    if previous:
        _release_driver(booking, now)
    DriverAssignment.objects.create(booking=booking, driver=driver, assigned_by=actor, team_notes=team_notes[:255])
    booking.driver = driver
    prev_status = booking.status
    booking.status = S.DRIVER_ASSIGNED
    booking.save()
    if prev_status != S.DRIVER_ASSIGNED:
        BookingStatusHistory.objects.create(booking=booking, from_status=prev_status, to_status=S.DRIVER_ASSIGNED,
                                            actor=actor, actor_role=actor.role, reason="Driver assigned")
    log_action(request, "driver_assigned", booking, f"{booking.reference} -> {driver.user.full_name}",
               {"driver": driver.pk, "previous": previous.pk if previous else None}, actor=actor)
    from apps.support.notify import notify
    notify(booking.customer, "DRIVER_ASSIGNED", f"Driver assigned to {booking.reference}",
           f"{driver.user.full_name} will handle your move on {booking.move_date}.", booking=booking)
    notify(driver.user, "JOB_ASSIGNED", f"New job {booking.reference}",
           f"Move on {booking.move_date}, {booking.pickup_city} to {booking.drop_city}.", booking=booking)
    return booking
