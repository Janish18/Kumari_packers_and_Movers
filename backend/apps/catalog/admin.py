from django.contrib import admin

from .models import FAQ, BusinessConfiguration, InventoryItem, PricingRule, ServiceArea, ServiceCategory, SiteContent

admin.site.register([ServiceCategory, ServiceArea, PricingRule, FAQ, SiteContent, BusinessConfiguration, InventoryItem])
