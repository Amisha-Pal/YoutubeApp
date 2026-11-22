from rest_framework import generics, permissions, serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import ChannelProfile
from .serializers import (
    ChannelProfileSerializer,
    RegisterSerializer,
    UserProfileSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "message": "Account created successfully.",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    throttle_scope = "auth"


class RefreshView(TokenRefreshView):
    throttle_scope = "auth"


class UserProfileView(generics.RetrieveAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class LogoutView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = serializers.Serializer

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"refresh": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            RefreshToken(refresh_token).blacklist()
        except Exception:
            return Response(
                {"refresh": "Invalid or expired refresh token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"message": "Successfully logged out."},
            status=status.HTTP_200_OK,
        )


class ChannelProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ChannelProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        profile, _ = ChannelProfile.objects.get_or_create(
            user=self.request.user
        )
        return profile
