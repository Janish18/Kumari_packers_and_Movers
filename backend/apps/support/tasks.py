from celery import shared_task

from .notify import _send_email


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_notification_email(self, notification_id):
    try:
        _send_email(notification_id)
    except Exception as exc:
        raise self.retry(exc=exc)
