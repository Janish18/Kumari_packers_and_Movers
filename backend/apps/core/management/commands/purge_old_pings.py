from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.bookings.models import LocationPing


class Command(BaseCommand):
    help = "Delete driver location pings older than N days (privacy retention). Schedule daily via cron."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=30)

    def handle(self, *a, **o):
        n, _ = LocationPing.objects.filter(recorded_at__lt=timezone.now() - timedelta(days=o["days"])).delete()
        self.stdout.write(f"Deleted {n} old location pings.")
