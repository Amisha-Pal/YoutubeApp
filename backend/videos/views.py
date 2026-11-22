from django.conf import settings
from django.db import models, transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from .notification_utils import (
    create_notification,
    send_notification_to_user,
)
from django.utils import timezone
from datetime import timedelta
from .models import (
    Video,
    VideoReaction,
    Comment,
    CommentReaction,
    Subscription,
    Notification,
    NotificationPreference,
    Playlist,
    PlaylistVideo,
)

from .serializers import (
    VideoSerializer,
    CommentSerializer,
    NotificationSerializer,
    NotificationPreferenceSerializer,
    ChannelProfileSerializer,
    PlaylistSerializer,
)

import logging
import os
import shutil

from django.contrib.auth import get_user_model
from django.db.models import Count, OuterRef, Q, Subquery
from rest_framework.exceptions import ValidationError

User = get_user_model()
logger = logging.getLogger(__name__)


def annotate_video_stats(queryset, user):
    queryset = queryset.select_related("owner").annotate(
        likes_total=Count(
            "reactions",
            filter=Q(reactions__reaction=VideoReaction.ReactionType.LIKE),
            distinct=True,
        ),
        dislikes_total=Count(
            "reactions",
            filter=Q(reactions__reaction=VideoReaction.ReactionType.DISLIKE),
            distinct=True,
        ),
    )
    if user is not None and user.is_authenticated:
        queryset = queryset.annotate(
            current_user_reaction=Subquery(
                VideoReaction.objects.filter(
                    video=OuterRef("pk"),
                    user=user,
                ).values("reaction")[:1]
            )
        )
    return queryset


def accessible_videos(user):
    """Videos a user may open directly: public/unlisted, or any of their own."""
    queryset = Video.objects.filter(
        status=Video.Status.PUBLISHED,
        visibility__in=[Video.Visibility.PUBLIC, Video.Visibility.UNLISTED],
    )
    if user.is_authenticated:
        queryset = Video.objects.filter(
            Q(pk__in=queryset.values("pk")) | Q(owner=user)
        )
    return queryset


def delete_video_files(video):
    try:
        if video.video_file:
            qualities_dir = os.path.join(
                os.path.dirname(video.video_file.path),
                "qualities",
                str(video.id),
            )
            shutil.rmtree(qualities_dir, ignore_errors=True)
            video.video_file.delete(save=False)
        if video.thumbnail:
            video.thumbnail.delete(save=False)
    except Exception:
        logger.exception("Failed to delete files for video %s", video.id)

class VideoListCreateView(generics.ListCreateAPIView):
    serializer_class = VideoSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = Video.objects.filter(
            status=Video.Status.PUBLISHED,
            visibility=Video.Visibility.PUBLIC,
        )

        search_query = self.request.query_params.get("search", "").strip()

        if search_query:
            queryset = queryset.filter(
                models.Q(title__icontains=search_query)
                | models.Q(description__icontains=search_query)
                | models.Q(owner__username__icontains=search_query)
            )

                # Filter videos by category
                # Filter videos by category
        category = self.request.query_params.get("category", "").strip()

        if category and category != "All":
            queryset = queryset.filter(category__iexact=category)

                # Filter videos by upload date
        upload_date = self.request.query_params.get("upload_date", "").strip()

        now = timezone.now()

        if upload_date == "today":
            queryset = queryset.filter(
                created_at__date=timezone.localdate()
            )

        elif upload_date == "week":
            queryset = queryset.filter(
                created_at__gte=now - timedelta(days=7)
            )

        elif upload_date == "month":
            queryset = queryset.filter(
                created_at__gte=now - timedelta(days=30)
            )

        elif upload_date == "year":
            queryset = queryset.filter(
                created_at__gte=now - timedelta(days=365)
            )

                # Filter videos by duration
        duration_filter = self.request.query_params.get("duration", "").strip()

        if duration_filter == "short":
            queryset = queryset.filter(duration__gt=0, duration__lte=60)

        elif duration_filter == "under_4":
            queryset = queryset.filter(duration__lt=240)

        elif duration_filter == "4_to_20":
            queryset = queryset.filter(
                duration__gte=240,
                duration__lte=1200,
            )

        elif duration_filter == "over_20":
            queryset = queryset.filter(duration__gt=1200)

        # Sort videos
        sort_by = self.request.query_params.get("sort", "latest")

        if sort_by == "popular":
            queryset = queryset.order_by("-views_count", "-created_at")
        elif sort_by == "trending":
            queryset = queryset.filter(
                created_at__gte=now - timedelta(days=30)
            ).order_by("-views_count", "-created_at")
        elif sort_by == "oldest":
            queryset = queryset.order_by("created_at")
        else:
            queryset = queryset.order_by("-created_at")

        return annotate_video_stats(queryset, self.request.user)

    @property
    def throttle_scope(self):
        return "upload" if self.request.method == "POST" else None

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]

        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        video = serializer.save(
            owner=self.request.user,
            status=Video.Status.PROCESSING,
        )

        # Celery task database transaction commit hone ke baad trigger hogi.
        from .tasks import process_uploaded_video

        transaction.on_commit(
            lambda: process_uploaded_video.delay(video.id)
        )

class VideoDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = VideoSerializer
    lookup_url_kwarg = "video_id"
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]

        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user

        if self.request.method in permissions.SAFE_METHODS:
            queryset = accessible_videos(user)
        else:
            queryset = Video.objects.filter(owner=user)

        return annotate_video_stats(queryset, user)

    def perform_update(self, serializer):
        instance = serializer.instance
        # Processing may have finished since this instance was loaded; keep
        # the worker's fields instead of overwriting them with stale values.
        instance.refresh_from_db(
            fields=["status", "duration", "video_qualities"]
        )
        old_thumbnail = instance.thumbnail.name if instance.thumbnail else ""

        video = serializer.save()

        new_thumbnail = video.thumbnail.name if video.thumbnail else ""
        if old_thumbnail and old_thumbnail != new_thumbnail:
            video.thumbnail.storage.delete(old_thumbnail)

    def perform_destroy(self, instance):
        delete_video_files(instance)
        instance.delete()


class MyVideosView(generics.ListAPIView):
    """All of the current user's uploads, including processing/private ones."""

    serializer_class = VideoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Video.objects.filter(owner=self.request.user)
        status_filter = self.request.query_params.get("status", "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return annotate_video_stats(queryset, self.request.user).order_by(
            "-created_at"
        )


class LikedVideosView(generics.ListAPIView):
    serializer_class = VideoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        liked_at = VideoReaction.objects.filter(
            video=OuterRef("pk"),
            user=user,
            reaction=VideoReaction.ReactionType.LIKE,
        ).values("updated_at")[:1]
        queryset = (
            accessible_videos(user)
            .filter(status=Video.Status.PUBLISHED)
            .annotate(liked_at=Subquery(liked_at))
            .filter(liked_at__isnull=False)
        )
        return annotate_video_stats(queryset, user).order_by("-liked_at")


class SubscriptionFeedView(generics.ListAPIView):
    serializer_class = VideoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Video.objects.filter(
            owner__subscribers__subscriber=user,
            status=Video.Status.PUBLISHED,
            visibility=Video.Visibility.PUBLIC,
        )
        return annotate_video_stats(queryset, user).order_by("-created_at")


class SubscribedChannelsView(generics.ListAPIView):
    serializer_class = ChannelProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return (
            User.objects.filter(
                id__in=Subscription.objects.filter(
                    subscriber=self.request.user
                ).values("channel")
            )
            .select_related("channel_profile")
            .annotate(subscribers_total=Count("subscribers", distinct=True))
            .order_by("username")
        )


class VideoViewCountView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, video_id):
        video = get_object_or_404(
            accessible_videos(request.user).filter(
                status=Video.Status.PUBLISHED
            ),
            id=video_id,
        )

        Video.objects.filter(id=video.id).update(
            views_count=F("views_count") + 1
        )

        video.refresh_from_db()

        return Response(
            {
                "message": "View counted successfully.",
                "video_id": video.id,
                "views_count": video.views_count,
            },
            status=status.HTTP_200_OK,
        )

class VideoReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, video_id):
        video = get_object_or_404(
            accessible_videos(request.user).filter(
                status=Video.Status.PUBLISHED
            ),
            id=video_id,
        )

        reaction_type = request.data.get("reaction")

        if reaction_type not in [
            VideoReaction.ReactionType.LIKE,
            VideoReaction.ReactionType.DISLIKE,
        ]:
            return Response(
                {
                    "error": "Reaction must be either 'like' or 'dislike'."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_reaction = VideoReaction.objects.filter(
            video=video,
            user=request.user,
        ).first()

        if existing_reaction:
            if existing_reaction.reaction == reaction_type:
                # Same button dobara click karne par reaction remove hoga.
                existing_reaction.delete()
                user_reaction = None

            else:
                # Like ko Dislike ya Dislike ko Like mein change karo.
                existing_reaction.reaction = reaction_type
                existing_reaction.save(update_fields=["reaction", "updated_at"])
                user_reaction = reaction_type

        else:
            # First time reaction create karo.
            VideoReaction.objects.create(
                video=video,
                user=request.user,
                reaction=reaction_type,
            )
            user_reaction = reaction_type

            # Notify video owner only when another user likes the video.
            if (
                reaction_type == VideoReaction.ReactionType.LIKE
                and video.owner != request.user
            ):
                notification = create_notification(
                    recipient=video.owner,
                    sender=request.user,
                    video=video,
                    notification_type=Notification.NotificationType.NEW_LIKE,
                    message=(
                        f"{request.user.username} liked your video: "
                        f"{video.title}"
                    ),
                )

                if notification:
                    transaction.on_commit(
                        lambda: send_notification_to_user(notification)
                    )

        likes_count = video.reactions.filter(
            reaction=VideoReaction.ReactionType.LIKE
        ).count()

        dislikes_count = video.reactions.filter(
            reaction=VideoReaction.ReactionType.DISLIKE
        ).count()

        return Response(
            {
                "message": "Reaction updated successfully.",
                "video_id": video.id,
                "likes_count": likes_count,
                "dislikes_count": dislikes_count,
                "user_reaction": user_reaction,
            },
            status=status.HTTP_200_OK,
        )


class IsCommentOwnerOrReadOnly(permissions.BasePermission):

    def has_object_permission(self, request, view, obj):

        if request.method in permissions.SAFE_METHODS:
            return True

        if request.method == "DELETE":
            # Video owners can moderate comments on their own videos.
            return obj.user == request.user or obj.video.owner_id == request.user.id

        return obj.user == request.user


class CommentListCreateView(generics.ListCreateAPIView):

    serializer_class = CommentSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]

        return [permissions.IsAuthenticated()]

    def get_video(self):
        return get_object_or_404(
            accessible_videos(self.request.user).filter(
                status=Video.Status.PUBLISHED
            ),
            id=self.kwargs["video_id"],
        )

    def get_queryset(self):
        video = self.get_video()

        return Comment.objects.filter(
            video=video,
            parent__isnull=True,
        ).select_related("user").prefetch_related(
            "reactions",
            "replies__user",
            "replies__reactions",
        )

    def perform_create(self, serializer):
        video = self.get_video()
        parent = serializer.validated_data.get("parent")

        if parent and parent.video_id != video.id:
            raise ValidationError({
                "parent": "Parent comment must belong to the same video."
            })

        serializer.save(
            video=video,
            user=self.request.user,
        )

        # Reply par original commenter ko notify karo.
        # Normal comment par video owner ko notify karo.
        recipient = parent.user if parent else video.owner

        # Khud ko notification nahi bhejni.
        if recipient != self.request.user:

            notification_type = (
                Notification.NotificationType.NEW_REPLY
                if parent
                else Notification.NotificationType.NEW_COMMENT
            )

            if parent:
                message = (
                    f"{self.request.user.username} replied to your comment "
                    f"on {video.title}"
                )
            else:
                message = (
                    f"{self.request.user.username} commented on your video: "
                    f"{video.title}"
                )

            notification = create_notification(
                recipient=recipient,
                sender=self.request.user,
                video=video,
                notification_type=notification_type,
                message=message,
            )

            if notification:
                transaction.on_commit(
                    lambda: send_notification_to_user(notification)
                )

class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):

    serializer_class = CommentSerializer

    permission_classes = [
        permissions.IsAuthenticatedOrReadOnly,
        IsCommentOwnerOrReadOnly,
    ]

    lookup_url_kwarg = "comment_id"

    def get_queryset(self):
        return Comment.objects.select_related(
            "user",
            "video",
        ).prefetch_related("reactions", "replies__user", "replies__reactions")


class CommentReactionView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, comment_id):

        comment = get_object_or_404(
            Comment.objects.select_related("user", "video").filter(
                video__in=accessible_videos(request.user)
            ),
            id=comment_id,
        )

        reaction_type = request.data.get("reaction")

        if reaction_type not in [
            CommentReaction.ReactionType.LIKE,
            CommentReaction.ReactionType.DISLIKE,
        ]:
            return Response(
                {
                    "error": "Reaction must be either 'like' or 'dislike'."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_reaction = CommentReaction.objects.filter(
            comment=comment,
            user=request.user,
        ).first()

        if existing_reaction:
            if existing_reaction.reaction == reaction_type:
                # Same button dobara click karne par reaction remove hoga.
                existing_reaction.delete()
                user_reaction = None

            else:
                # Like ko Dislike ya Dislike ko Like mein change karo.
                existing_reaction.reaction = reaction_type
                existing_reaction.save(
                    update_fields=["reaction", "updated_at"]
                )
                user_reaction = reaction_type

        else:
            # First time reaction create karo.
            CommentReaction.objects.create(
                comment=comment,
                user=request.user,
                reaction=reaction_type,
            )
            user_reaction = reaction_type

            # Notify the comment author when another user likes their comment.
            if (
                reaction_type == CommentReaction.ReactionType.LIKE
                and comment.user_id != request.user.id
            ):
                notification = create_notification(
                    recipient=comment.user,
                    sender=request.user,
                    video=comment.video,
                    notification_type=Notification.NotificationType.NEW_LIKE,
                    message=(
                        f"{request.user.username} liked your comment on "
                        f"{comment.video.title}"
                    ),
                )

                if notification:
                    transaction.on_commit(
                        lambda: send_notification_to_user(notification)
                    )

        likes_count = comment.reactions.filter(
            reaction=CommentReaction.ReactionType.LIKE
        ).count()

        dislikes_count = comment.reactions.filter(
            reaction=CommentReaction.ReactionType.DISLIKE
        ).count()

        return Response(
            {
                "message": "Comment reaction updated successfully.",
                "comment_id": comment.id,
                "likes_count": likes_count,
                "dislikes_count": dislikes_count,
                "user_reaction": user_reaction,
            },
            status=status.HTTP_200_OK,
        )

class SubscriptionView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id):

        channel = get_object_or_404(
            User,
            id=channel_id,
        )

        is_subscribed = Subscription.objects.filter(
            subscriber=request.user,
            channel=channel,
        ).exists()

        subscribers_count = Subscription.objects.filter(
            channel=channel,
        ).count()

        return Response({
            "channel_id": channel.id,
            "is_subscribed": is_subscribed,
            "subscribers_count": subscribers_count,
    })

    def post(self, request, channel_id):

        channel = get_object_or_404(
            User,
            id=channel_id,
        )

        if channel.id == request.user.id:
            return Response(
                {"error": "You cannot subscribe to your own channel."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subscription, created = Subscription.objects.get_or_create(
            subscriber=request.user,
            channel=channel,
        )

        # Notify channel owner only for a new subscription.
        if created:
            notification = create_notification(
                recipient=channel,
                sender=request.user,
                notification_type=(
                    Notification.NotificationType.NEW_SUBSCRIBER
                ),
                message=(
                    f"{request.user.username} subscribed to your channel."
                ),
            )

            if notification:
                transaction.on_commit(
                    lambda: send_notification_to_user(notification)
                )

        subscribers_count = Subscription.objects.filter(
            channel=channel,
        ).count()

        return Response({
            "message": (
                "Subscribed successfully."
                if created else "Already subscribed."
            ),
            "is_subscribed": True,
            "subscribers_count": subscribers_count,
        })

    def delete(self, request, channel_id):

        channel = get_object_or_404(
            User,
            id=channel_id,
        )

        deleted_count, _ = Subscription.objects.filter(
            subscriber=request.user,
            channel=channel,
        ).delete()

        subscribers_count = Subscription.objects.filter(
            channel=channel,
        ).count()

        return Response({
            "message": (
                "Unsubscribed successfully."
                if deleted_count else "You were not subscribed."
            ),
            "is_subscribed": False,
            "subscribers_count": subscribers_count,
        })

class NotificationListView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):

        notifications = Notification.objects.filter(
            recipient=request.user
        ).select_related(
            "sender",
            "video",
        )

        serializer = NotificationSerializer(
            notifications[:100],
            many=True,
        )

        unread_count = notifications.filter(
            is_read=False
        ).count()

        return Response({
            "notifications": serializer.data,
            "unread_count": unread_count,
        })

class NotificationPreferenceView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):

        preferences, created = NotificationPreference.objects.get_or_create(
            user=request.user
        )

        serializer = NotificationPreferenceSerializer(preferences)
        return Response(serializer.data)

    def patch(self, request):

        preferences, created = NotificationPreference.objects.get_or_create(
            user=request.user
        )

        serializer = NotificationPreferenceSerializer(
            preferences,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)


class NotificationMarkReadView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):

        notification = get_object_or_404(
            Notification,
            id=notification_id,
            recipient=request.user,
        )

        notification.is_read = True
        notification.save(update_fields=["is_read"])

        return Response({
            "message": "Notification marked as read.",
            "is_read": True,
        })

class NotificationMarkAllReadView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):

        updated_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).update(is_read=True)

        return Response({
            "message": "All notifications marked as read.",
            "updated_count": updated_count,
            "unread_count": 0,
        })

class ChannelSearchView(generics.ListAPIView):

    serializer_class = ChannelProfileSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        search_query = self.request.query_params.get(
            "search", ""
        ).strip()

        queryset = User.objects.select_related("channel_profile").annotate(
            subscribers_total=Count("subscribers", distinct=True)
        )

        if search_query:
            queryset = queryset.filter(
                username__icontains=search_query
            )

        return queryset.order_by("username")[:50]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context        

class ChannelProfileView(APIView):

    permission_classes = [permissions.AllowAny]

    def get(self, request, channel_id):

        channel = get_object_or_404(
            User,
            id=channel_id,
        )

        serializer = ChannelProfileSerializer(
            channel,
            context={"request": request},
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

class ChannelVideosView(generics.ListAPIView):

    serializer_class = VideoSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        channel_id = self.kwargs["channel_id"]

        queryset = Video.objects.filter(
            owner_id=channel_id,
            status=Video.Status.PUBLISHED,
            visibility=Video.Visibility.PUBLIC,
        )
        sort_by = self.request.query_params.get("sort", "latest")
        if sort_by == "popular":
            queryset = queryset.order_by("-views_count", "-created_at")
        elif sort_by == "oldest":
            queryset = queryset.order_by("created_at")
        else:
            queryset = queryset.order_by("-created_at")
        return annotate_video_stats(queryset, self.request.user)

class PlaylistListCreateView(generics.ListCreateAPIView):

    serializer_class = PlaylistSerializer

    def get_queryset(self):
        user = self.request.user

        queryset = Playlist.objects.select_related(
            "owner"
        ).prefetch_related(
            "playlist_items__video__owner"
        )

        owner_filter = self.request.query_params.get("owner", "").strip()
        if owner_filter == "me":
            if not user.is_authenticated:
                return queryset.none()
            return queryset.filter(owner=user)
        if owner_filter.isdigit():
            queryset = queryset.filter(owner_id=int(owner_filter))

        # Logged-in user apni private playlists bhi dekh sakta hai.
        if user.is_authenticated:
            return queryset.filter(
                models.Q(visibility=Playlist.Visibility.PUBLIC)
                | models.Q(owner=user)
            ).distinct()

        return queryset.filter(
            visibility=Playlist.Visibility.PUBLIC
        )

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]

        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

class PlaylistDetailView(generics.RetrieveUpdateDestroyAPIView):

    serializer_class = PlaylistSerializer
    lookup_url_kwarg = "playlist_id"

    def get_queryset(self):
        user = self.request.user

        queryset = Playlist.objects.select_related(
            "owner"
        ).prefetch_related(
            "playlist_items__video__owner"
        )

        # GET: Public playlists aur apni private playlists.
        if self.request.method == "GET":
            if user.is_authenticated:
                return queryset.filter(
                    models.Q(visibility=Playlist.Visibility.PUBLIC)
                    | models.Q(owner=user)
                ).distinct()

            return queryset.filter(
                visibility=Playlist.Visibility.PUBLIC
            )

        # PATCH / PUT / DELETE: Sirf owner.
        if user.is_authenticated:
            return queryset.filter(owner=user)

        return queryset.none()

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]

        return [permissions.IsAuthenticated()]

class PlaylistAddVideoView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, playlist_id):

        playlist = get_object_or_404(
            Playlist,
            id=playlist_id,
            owner=request.user,
        )

        video_id = request.data.get("video_id")

        if not video_id:
            return Response(
                {"detail": "video_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        video = get_object_or_404(
            Video,
            id=video_id,
            status=Video.Status.PUBLISHED,
        )
        # Non-public videos cannot be added to public playlists.
        if (
            playlist.visibility == Playlist.Visibility.PUBLIC
            and video.visibility != Video.Visibility.PUBLIC
        ):
            return Response(
                {
                    "detail": (
                        "Only public videos can be added "
                        "to public playlists."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Users cannot add another user's private or unlisted videos.
        if (
            video.owner != request.user
            and video.visibility != Video.Visibility.PUBLIC
        ):
            return Response(
                {"detail": "You cannot add this video."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if PlaylistVideo.objects.filter(
            playlist=playlist,
            video=video,
        ).exists():
            return Response(
                {"detail": "Video already exists in this playlist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        last_item = playlist.playlist_items.order_by(
            "-position"
        ).first()

        next_position = (
            last_item.position + 1
            if last_item
            else 0
        )

        PlaylistVideo.objects.create(
            playlist=playlist,
            video=video,
            position=next_position,
        )

        return Response(
            {"detail": "Video added to playlist successfully."},
            status=status.HTTP_201_CREATED,
        )

class PlaylistRemoveVideoView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, playlist_id, video_id):

        playlist = get_object_or_404(
            Playlist,
            id=playlist_id,
            owner=request.user,
        )

        playlist_video = get_object_or_404(
            PlaylistVideo,
            playlist=playlist,
            video_id=video_id,
        )

        playlist_video.delete()

        return Response(
            {"detail": "Video removed from playlist successfully."},
            status=status.HTTP_200_OK,
        )

class PlaylistReorderView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, playlist_id):

        playlist = get_object_or_404(
            Playlist,
            id=playlist_id,
            owner=request.user,
        )

        video_ids = request.data.get("video_ids")

        if not isinstance(video_ids, list):
            return Response(
                {"detail": "video_ids must be a list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(video_ids) != len(set(video_ids)):
            return Response(
                {"detail": "Duplicate video IDs are not allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():

            playlist_videos = list(
                PlaylistVideo.objects.filter(
                    playlist=playlist
                ).order_by("position", "added_at")
            )

            existing_ids = {
                item.video_id for item in playlist_videos
            }

            if set(video_ids) != existing_ids:
                return Response(
                    {
                        "detail": (
                            "Video IDs must exactly match "
                            "the videos in this playlist."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            video_map = {
                item.video_id: item
                for item in playlist_videos
            }

            for position, video_id in enumerate(video_ids):
                video_map[video_id].position = position

            PlaylistVideo.objects.bulk_update(
                playlist_videos,
                ["position"],
            )

        return Response(
            {"detail": "Playlist reordered successfully."},
            status=status.HTTP_200_OK,
        )
        
class NotificationDeleteView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, notification_id):

        notification = get_object_or_404(
            Notification,
            id=notification_id,
            recipient=request.user,
        )

        notification.delete()

        return Response({
            "message": "Notification deleted successfully."
        })
        
