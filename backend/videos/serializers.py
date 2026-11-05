from pathlib import Path
from rest_framework import serializers
from .models import Video

class VideoSerializer(serializers.ModelSerializer):
    owner_username = serializers.ReadOnlyField(source="owner.username")

    video_file = serializers.FileField(
        required=True,
        allow_empty_file=False,
    )

    thumbnail = serializers.ImageField(
        required=False,
        allow_null=True,
    )

    MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500 MB
    MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024  # 5 MB

    ALLOWED_VIDEO_EXTENSIONS = {
        ".mp4",
        ".mov",
        ".webm",
        ".mkv",
    }

    ALLOWED_THUMBNAIL_EXTENSIONS = {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }

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
            "owner_username",
            "status",
            "views_count",
            "created_at",
            "updated_at",
        ]

    def validate_title(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Video title cannot be empty."
            )

        return value

    def validate_video_file(self, value):
        extension = Path(value.name).suffix.lower()

        if extension not in self.ALLOWED_VIDEO_EXTENSIONS:
            raise serializers.ValidationError(
                "Only MP4, MOV, WEBM and MKV videos are allowed."
            )

        if value.size > self.MAX_VIDEO_SIZE:
            raise serializers.ValidationError(
                "Video size cannot exceed 500 MB."
            )

        if value.size == 0:
            raise serializers.ValidationError(
                "Video file cannot be empty."
            )

        return value

    def validate_thumbnail(self, value):
        if value is None:
            return value

        extension = Path(value.name).suffix.lower()

        if extension not in self.ALLOWED_THUMBNAIL_EXTENSIONS:
            raise serializers.ValidationError(
                "Only JPG, JPEG, PNG and WEBP thumbnails are allowed."
            )

        if value.size > self.MAX_THUMBNAIL_SIZE:
            raise serializers.ValidationError(
                "Thumbnail size cannot exceed 5 MB."
            )

        if value.size == 0:
            raise serializers.ValidationError(
                "Thumbnail cannot be empty."
            )

        return value
