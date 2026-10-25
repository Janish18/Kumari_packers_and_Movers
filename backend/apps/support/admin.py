from django.contrib import admin

from .models import DamageReport, Notification, Review, SupportTicket

admin.site.register([Notification, Review, SupportTicket, DamageReport])
