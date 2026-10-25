from django.contrib import admin

from .models import (Booking, BookingInventoryItem, BookingStatusHistory, DriverAssignment, JobEvent, LocationPing,
                     Quotation, QuotationLineItem, RescheduleRequest)

admin.site.register([Booking, BookingInventoryItem, Quotation, QuotationLineItem, BookingStatusHistory, DriverAssignment,
                     JobEvent, LocationPing, RescheduleRequest])
