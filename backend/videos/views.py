
from django.db import models
from rest_framework import generics, permissions
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Video
from .serializers import VideoSerializer


class VideoListCreateView(generics.ListCreateAPIView):
    serializer_class = VideoSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = Video.objects.filter(
            status=Video.Status.PUBLISHED,
            visibility=Video.Visibility.PUBLIC,
        )

        # Private videos listing mein nahi dikhenge.
        # Unlisted videos bhi public listing mein nahi dikhenge.
        return queryset.select_related("owner")

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]

        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class VideoDetailView(generics.RetrieveAPIView):
    serializer_class = VideoSerializer
    lookup_url_kwarg = "video_id"

    def get_queryset(self):
        user = self.request.user

        queryset = Video.objects.filter(
            status=Video.Status.PUBLISHED
        )

        if user.is_authenticated:
            return queryset.filter(
                models.Q(visibility=Video.Visibility.PUBLIC)
                | models.Q(visibility=Video.Visibility.UNLISTED)
                | models.Q(owner=user)
            ).select_related("owner")

        return queryset.filter(
            visibility=Video.Visibility.PUBLIC
        ).select_related("owner")
