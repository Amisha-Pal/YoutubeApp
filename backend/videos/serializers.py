
from rest_framework import serializers
from .models import Video


class VideoSerializer(serializers.ModelSerializer):
    owner_username = serializers.ReadOnlyField(source="owner.username")

    class Meta:
        model = Video
        fields = [
            "id",
            "owner",
            "owner_username",
            "title",
            "description",
            "category",
            "visibility",
            "video_file",
            "thumbnail",
            "status",
            "views_count",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "owner",
            "status",
            "views_count",
            "created_at",
            "updated_at",
        ]
