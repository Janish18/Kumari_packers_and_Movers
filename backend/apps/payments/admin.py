from django.contrib import admin

from .models import Invoice, Payment, Refund, WebhookEvent

admin.site.register([Payment, Refund, Invoice, WebhookEvent])
