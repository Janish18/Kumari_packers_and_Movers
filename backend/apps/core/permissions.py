from rest_framework.permissions import BasePermission

ROLE_CUSTOMER, ROLE_ADMIN, ROLE_DRIVER = "CUSTOMER", "ADMIN", "DRIVER"


class _RolePermission(BasePermission):
    role = None

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_active and u.role == self.role)


class IsCustomer(_RolePermission):
    role = ROLE_CUSTOMER


class IsAdminRole(_RolePermission):
    role = ROLE_ADMIN


class IsDriver(_RolePermission):
    role = ROLE_DRIVER
