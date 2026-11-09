from pathlib import Path
from rest_framework import serializers
from .models import Video, VideoReaction, Comment, CommentReaction, Notification

class VideoSerializer(serializers.ModelSerializer):

    owner_username = serializers.ReadOnlyField(source="owner.username")

    likes_count = serializers.SerializerMethodField()
    dislikes_count = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()

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
            "likes_count",
            "dislikes_count",
            "user_reaction",
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

    def get_likes_count(self, obj):
        return obj.reactions.filter(
            reaction=VideoReaction.ReactionType.LIKE
        ).count()

    def get_dislikes_count(self, obj):
        return obj.reactions.filter(
            reaction=VideoReaction.ReactionType.DISLIKE
        ).count()

    def get_user_reaction(self, obj):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            return None

        reaction = obj.reactions.filter(
            user=request.user
        ).first()

        return reaction.reaction if reaction else None

class CommentSerializer(serializers.ModelSerializer):

    username = serializers.ReadOnlyField(source="user.username")

    replies = serializers.SerializerMethodField()

    likes_count = serializers.SerializerMethodField()
    dislikes_count = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()

    class Meta:
        model = Comment

        fields = [
            "id",
            "video",
            "user",
            "username",
            "parent",
            "content",
            "created_at",
            "updated_at",
            "likes_count",
            "dislikes_count",
            "user_reaction",
            "replies",
        ]

        read_only_fields = [
            "id",
            "video",
            "user",
            "username",
            "created_at",
            "updated_at",
            "replies",
            "likes_count",
            "dislikes_count",
            "user_reaction",
        ]

    def get_replies(self, obj):
        replies = obj.replies.all()

        return CommentSerializer(
            replies,
            many=True,
            context=self.context,
        ).data

    def get_likes_count(self, obj):
        return obj.reactions.filter(
            reaction=CommentReaction.ReactionType.LIKE
        ).count()

    def get_dislikes_count(self, obj):
        return obj.reactions.filter(
            reaction=CommentReaction.ReactionType.DISLIKE
        ).count()

    def get_user_reaction(self, obj):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            return None

        reaction = obj.reactions.filter(
            user=request.user
        ).first()

        return reaction.reaction if reaction else None

    def validate_content(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Comment cannot be empty."
            )

        if len(value) > 2000:
            raise serializers.ValidationError(
                "Comment cannot exceed 2000 characters."
            )

        return value


class NotificationSerializer(serializers.ModelSerializer):

    sender_username = serializers.ReadOnlyField(
        source="sender.username"
    )

    video_title = serializers.ReadOnlyField(
        source="video.title"
    )

    class Meta:
        model = Notification

        fields = [
            "id",
            "recipient",
            "sender",
            "sender_username",
            "video",
            "video_title",
            "notification_type",
            "message",
            "is_read",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "recipient",
            "sender",
            "sender_username",
            "video",
            "video_title",
            "notification_type",
            "message",
            "created_at",
        ]