from pathlib import Path
from rest_framework import serializers
from .models import (
    Video,
    VideoReaction,
    Comment,
    CommentReaction,
    Notification,
    NotificationPreference,
    Playlist,
    PlaylistVideo,
)

class VideoSerializer(serializers.ModelSerializer):

    owner_username = serializers.ReadOnlyField(source="owner.username")

    likes_count = serializers.SerializerMethodField()
    dislikes_count = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()
    video_qualities = serializers.ReadOnlyField()

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
            "video_qualities",
            "thumbnail",
            "status",
            "duration",
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
            "duration",
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

class NotificationPreferenceSerializer(serializers.ModelSerializer):

    class Meta:
        model = NotificationPreference

        fields = [
            "new_video",
            "new_comment",
            "new_reply",
            "new_subscriber",
            "new_like",
            "sound_enabled",
            "updated_at",
        ]

        read_only_fields = [
            "updated_at",
        ]

from django.contrib.auth import get_user_model
User = get_user_model()

class ChannelProfileSerializer(serializers.ModelSerializer):

    subscribers_count = serializers.SerializerMethodField()
    videos_count = serializers.SerializerMethodField()
    is_subscribed = serializers.SerializerMethodField()
    channel_customization = serializers.SerializerMethodField()

    class Meta:
        model = User

        fields = [
            "id",
            "username",
            "subscribers_count",
            "videos_count",
            "is_subscribed",
            "channel_customization",
        ]

    def get_subscribers_count(self, obj):
        return obj.subscribers.count()

    def get_videos_count(self, obj):
        return Video.objects.filter(
            owner=obj,
            status=Video.Status.PUBLISHED,
            visibility=Video.Visibility.PUBLIC,
        ).count()

    def get_is_subscribed(self, obj):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            return False

        return obj.subscribers.filter(
            subscriber=request.user
        ).exists()

    def get_channel_customization(self, obj):
        try:
            profile = obj.channel_profile
        except Exception:
            return {
                "profile_picture": None,
                "banner": None,
                "description": "",
            }

        request = self.context.get("request")

        profile_picture = None
        banner = None

        if profile.profile_picture:
            profile_picture = profile.profile_picture.url

            if request:
                profile_picture = request.build_absolute_uri(
                    profile_picture
                )

        if profile.banner:
            banner = profile.banner.url

            if request:
                banner = request.build_absolute_uri(banner)

        return {
            "profile_picture": profile_picture,
            "banner": banner,
            "description": profile.description,
        }

class PlaylistVideoSerializer(serializers.ModelSerializer):

    video_title = serializers.CharField(
        source="video.title",
        read_only=True,
    )

    video_thumbnail = serializers.ImageField(
        source="video.thumbnail",
        read_only=True,
    )

    owner_username = serializers.CharField(
        source="video.owner.username",
        read_only=True,
    )

    class Meta:
        model = PlaylistVideo

        fields = [
            "id",
            "video",
            "video_title",
            "video_thumbnail",
            "owner_username",
            "position",
            "added_at",
        ]

        read_only_fields = [
            "id",
            "video_title",
            "video_thumbnail",
            "owner_username",
            "added_at",
        ]

class PlaylistSerializer(serializers.ModelSerializer):

    owner_username = serializers.CharField(
        source="owner.username",
        read_only=True,
    )

    videos_count = serializers.SerializerMethodField()

    videos = PlaylistVideoSerializer(
        source="playlist_items",
        many=True,
        read_only=True,
    )

    class Meta:
        model = Playlist

        fields = [
            "id",
            "owner",
            "owner_username",
            "title",
            "description",
            "visibility",
            "videos_count",
            "videos",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "owner",
            "owner_username",
            "videos_count",
            "videos",
            "created_at",
            "updated_at",
        ]

    def get_videos_count(self, obj):
        return obj.videos.count()

    def validate_title(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Playlist title cannot be empty."
            )

        return value
        