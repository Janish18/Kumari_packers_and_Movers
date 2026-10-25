import getpass

from django.contrib.auth import password_validation
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import Role, User


class Command(BaseCommand):
    help = "Securely create an administrator (the only way admins are provisioned)."

    def add_arguments(self, p):
        p.add_argument("--email", required=True)
        p.add_argument("--name", required=True)
        p.add_argument("--phone", default=None)

    def handle(self, *a, **o):
        if User.objects.filter(email=o["email"].lower()).exists():
            raise CommandError("A user with that email already exists.")
        pw = getpass.getpass("Password: ")
        if pw != getpass.getpass("Confirm password: "):
            raise CommandError("Passwords do not match.")
        password_validation.validate_password(pw)
        User.objects.create_superuser(email=o["email"], password=pw, full_name=o["name"], phone=o["phone"])
        self.stdout.write(self.style.SUCCESS("Administrator created."))
