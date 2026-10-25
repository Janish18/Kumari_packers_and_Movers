from django.contrib import admin

from .models import AuditLog, UploadedFile

admin.site.register([AuditLog, UploadedFile])
