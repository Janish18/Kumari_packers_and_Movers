from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.accounts import views_admin as acc_admin
from apps.bookings import views_admin as bk_admin, views_customer as bk_cust, views_driver as bk_driver, views_quote
from apps.catalog import views as cat
from apps.core import admin_views as core_admin
from apps.payments import views as pay
from apps.support import views as sup

v1 = DefaultRouter()
# customer
v1.register("customer/bookings", bk_cust.CustomerBookingViewSet, basename="customer-booking")
v1.register("customer/payments", pay.CustomerPaymentViewSet, basename="customer-payment")
v1.register("customer/invoices", pay.CustomerInvoiceViewSet, basename="customer-invoice")
v1.register("customer/reviews", sup.CustomerReviewViewSet, basename="customer-review")
v1.register("customer/support-tickets", sup.CustomerTicketViewSet, basename="customer-ticket")
v1.register("customer/damage-reports", sup.CustomerDamageViewSet, basename="customer-damage")
v1.register("notifications", sup.NotificationViewSet, basename="notification")
# driver
v1.register("driver/jobs", bk_driver.DriverJobViewSet, basename="driver-job")
# admin
v1.register("admin/customers", acc_admin.AdminCustomerViewSet, basename="admin-customer")
v1.register("admin/drivers", acc_admin.AdminDriverViewSet, basename="admin-driver")
v1.register("admin/vehicles", acc_admin.AdminVehicleViewSet, basename="admin-vehicle")
v1.register("admin/services", cat.AdminServiceViewSet, basename="admin-service")
v1.register("admin/service-areas", cat.AdminAreaViewSet, basename="admin-area")
v1.register("admin/pricing-rules", cat.AdminPricingViewSet, basename="admin-pricing")
v1.register("admin/faqs", cat.AdminFAQViewSet, basename="admin-faq")
v1.register("admin/site-content", cat.AdminContentViewSet, basename="admin-content")
v1.register("admin/config", cat.AdminConfigViewSet, basename="admin-config")
v1.register("admin/inventory-items", cat.AdminInventoryItemViewSet, basename="admin-inventory")
v1.register("admin/bookings", bk_admin.AdminBookingViewSet, basename="admin-booking")
v1.register("admin/quotations", bk_admin.AdminQuotationViewSet, basename="admin-quotation")
v1.register("admin/payments", pay.AdminPaymentViewSet, basename="admin-payment")
v1.register("admin/audit-logs", core_admin.AdminAuditLogViewSet, basename="admin-audit")
v1.register("admin/reviews", sup.AdminReviewViewSet, basename="admin-review")
v1.register("admin/support-tickets", sup.AdminTicketViewSet, basename="admin-ticket")
v1.register("admin/damage-reports", sup.AdminDamageViewSet, basename="admin-damage")

api = [
    path("auth/", include("apps.accounts.urls")),
    # public
    path("services/", cat.PublicServices.as_view()),
    path("service-areas/", cat.PublicAreas.as_view()),
    path("faqs/", cat.PublicFAQs.as_view()),
    path("reviews/", sup.PublicReviews.as_view()),
    path("inventory-items/", cat.PublicInventoryItems.as_view()),
    path("site-config/", cat.PublicSiteConfig.as_view()),
    path("quotes/estimate/", cat.EstimateView.as_view()),
    path("quotes/request/", views_quote.QuoteRequestView.as_view()),
    path("payments/webhook/", pay.WebhookView.as_view()),
    # dashboards / reports
    path("customer/dashboard/", bk_cust.CustomerDashboardView.as_view()),
    path("driver/dashboard/", bk_driver.DriverDashboardView.as_view()),
    path("admin/dashboard/", core_admin.AdminDashboardView.as_view()),
    path("admin/reports/", core_admin.AdminReportView.as_view()),
    path("", include(v1.urls)),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/", include(api)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
