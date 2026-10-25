"""Public estimate lives in catalog. `quotes/request/` creates a submitted booking for the logged-in customer."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.permissions import IsCustomer

from .serializers import BookingDetailSerializer, BookingInputSerializer


class QuoteRequestView(APIView):
    permission_classes = [IsCustomer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "quote"

    def post(self, request):
        data = {**request.data, "submit": True}
        ser = BookingInputSerializer(data=data, context={"request": request})
        ser.is_valid(raise_exception=True)
        return Response(BookingDetailSerializer(ser.save()).data, status=status.HTTP_201_CREATED)
