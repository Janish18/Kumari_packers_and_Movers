"""Consistent JSON error envelope: {"error": {"code", "message", "details"}}"""
import logging

from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(detail=exc.messages)
    elif isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API error", exc_info=exc)
        return Response(
            {"error": {"code": "server_error", "message": "Something went wrong. Please try again.", "details": None}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = response.data
    details = None
    if isinstance(exc, exceptions.ValidationError):
        code, message, details = "validation_error", "Please correct the highlighted fields.", data
    else:
        code = getattr(exc, "default_code", "error")
        message = data.get("detail") if isinstance(data, dict) and "detail" in data else str(data)
        message = str(message)
    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response
