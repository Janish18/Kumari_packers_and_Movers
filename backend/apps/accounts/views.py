from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.mail import send_mail
from django.db.models import Q
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.audit import log_action

from .models import Address, User
from .serializers import (AddressSerializer, ChangePasswordSerializer, ForgotPasswordSerializer, LoginSerializer,
                          ProfileUpdateSerializer, RegisterSerializer, ResetPasswordSerializer, UserSerializer)

GENERIC_FAIL = "Invalid credentials. Please check your details and try again."
MAX_FAILS, LOCK_SECONDS = 5, 15 * 60


def set_refresh_cookie(response, refresh, remember=False):
    max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()) if remember else None
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME, str(refresh), max_age=max_age, httponly=True,
        secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE, path="/api/v1/auth/",
    )


def require_xhr(request):
    """Cookie-authenticated state change: demand a custom header (blocks cross-site form posts)."""
    return request.headers.get("X-Requested-With") == "XMLHttpRequest"


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = RegisterSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def create(self, request, *a, **kw):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response({"user": UserSerializer(user).data, "message": "Account created. Please log in."},
                        status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ident = ser.validated_data["identifier"].strip().lower()
        key = f"loginfail:{ident}"
        if cache.get(key, 0) >= MAX_FAILS:
            return Response({"error": {"code": "locked", "message": "Too many attempts. Try again in 15 minutes.", "details": None}},
                            status=status.HTTP_429_TOO_MANY_REQUESTS)
        phone = ident.replace(" ", "")
        user = User.objects.filter(Q(email=ident) | Q(phone=phone)).first()
        authed = authenticate(request, username=user.email, password=ser.validated_data["password"]) if user else None
        if not authed or not authed.is_active:
            cache.set(key, cache.get(key, 0) + 1, LOCK_SECONDS)
            return Response({"error": {"code": "invalid_credentials", "message": GENERIC_FAIL, "details": None}},
                            status=status.HTTP_401_UNAUTHORIZED)
        cache.delete(key)
        refresh = RefreshToken.for_user(authed)
        refresh["role"] = authed.role
        resp = Response({"access": str(refresh.access_token), "user": UserSerializer(authed).data})
        set_refresh_cookie(resp, refresh, ser.validated_data["remember_me"])
        return resp


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        err = Response({"error": {"code": "not_authenticated", "message": "Session expired. Please log in.", "details": None}},
                       status=status.HTTP_401_UNAUTHORIZED)
        raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw or not require_xhr(request):
            return err
        try:
            old = RefreshToken(raw)
            user = User.objects.get(pk=old["user_id"], is_active=True)
            old.blacklist()
        except (TokenError, User.DoesNotExist, KeyError):
            return err
        new = RefreshToken.for_user(user)
        new["role"] = user.role
        resp = Response({"access": str(new.access_token), "user": UserSerializer(user).data})
        set_refresh_cookie(resp, new, remember=True)
        return resp


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        resp = Response(status=status.HTTP_204_NO_CONTENT)
        resp.delete_cookie(settings.REFRESH_COOKIE_NAME, path="/api/v1/auth/")
        return resp


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        ser = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        request.user.set_password(ser.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        log_action(request, "password_changed", request.user, "User changed password")
        return Response({"message": "Password updated."})


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        ser = ForgotPasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = User.objects.filter(email=ser.validated_data["email"].lower(), is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            send_mail("Reset your Kumari Packers and Movers password",
                      f"Hello {user.full_name},\n\nUse this link to reset your password (valid for 1 hour):\n{link}\n\n"
                      "If you did not request this, you can ignore this email.",
                      settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)
        # Same response whether or not the account exists.
        return Response({"message": "If that email is registered, a reset link has been sent."})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        from django.contrib.auth import password_validation
        from django.core.exceptions import ValidationError as DjVE
        from rest_framework.exceptions import ValidationError
        ser = ResetPasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(d["uid"])), is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            user = None
        if not user or not default_token_generator.check_token(user, d["token"]):
            raise ValidationError({"token": "This reset link is invalid or has expired."})
        try:
            password_validation.validate_password(d["new_password"], user)
        except DjVE as exc:
            raise ValidationError({"new_password": list(exc.messages)})
        user.set_password(d["new_password"])
        user.save(update_fields=["password"])
        log_action(request, "password_reset", user, "Password reset via email link", actor=user)
        return Response({"message": "Password reset. You can now log in."})


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    pagination_class = None

    def get_queryset(self):  # ownership enforced here
        return Address.objects.filter(user=self.request.user)
