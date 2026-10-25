import logging

from django.conf import settings
from django.core.mail import send_mail

from .models import Notification

logger = logging.getLogger(__name__)
EMAIL_KINDS = {"BOOKING_CONFIRMATION", "QUOTATION", "BOOKING_STATUS", "PAYMENT", "DRIVER_ASSIGNED", "SCHEDULE",
               "REFUND", "SUPPORT"}


def _send_email(notification_id):
    n = Notification.objects.select_related("user").get(pk=notification_id)
    prof = getattr(n.user, "customer_profile", None)
    if prof is not None and not prof.notify_email:
        n.email_status = "SKIPPED"
    else:
        try:
            send_mail(n.title, n.body or n.title, settings.DEFAULT_FROM_EMAIL, [n.user.email])
            n.email_status = "SENT"
        except Exception:  # delivery failure must never break the business operation
            logger.exception("Email delivery failed for notification %s", n.pk)
            n.email_status = "FAILED"
    n.save(update_fields=["email_status"])


def notify(user, kind, title, body="", booking=None, email=True):
    """Create an in-app notification and attempt email delivery (via Celery when a broker is configured)."""
    n = Notification.objects.create(user=user, kind=kind, title=title[:160], body=body[:500], booking=booking)
    if email and kind in EMAIL_KINDS and user.role != "DRIVER":
        if settings.CELERY_BROKER_URL:
            from .tasks import send_notification_email
            send_notification_email.delay(n.pk)
        else:
            _send_email(n.pk)
    return n


def notify_admins(kind, title, body="", booking=None):
    from apps.accounts.models import Role, User
    for u in User.objects.filter(role=Role.ADMIN, is_active=True):
        notify(u, kind, title, body, booking=booking, email=False)
