from django.conf import settings
from django.db import models, transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Video, VideoReaction, Comment, CommentReaction, Subscription, Notification
from .serializers import VideoSerializer, CommentSerializer, NotificationSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

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

        # Sort videos
        sort_by = self.request.query_params.get("sort", "latest")

        if sort_by == "popular":
            queryset = queryset.order_by("-views_count", "-created_at")
        elif sort_by == "oldest":
            queryset = queryset.order_by("created_at")
        else:
            queryset = queryset.order_by("-created_at")

        return queryset.select_related("owner").distinct()

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

class VideoViewCountView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, video_id):
        video = get_object_or_404(
            Video,
            id=video_id,
            status=Video.Status.PUBLISHED,
            visibility=Video.Visibility.PUBLIC,
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
            Video,
            id=video_id,
            status=Video.Status.PUBLISHED,
            visibility=Video.Visibility.PUBLIC,
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

        return obj.user == request.user


class CommentListCreateView(generics.ListCreateAPIView):

    serializer_class = CommentSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]

        return [permissions.IsAuthenticated()]

    def get_video(self):
        user = self.request.user

        queryset = Video.objects.filter(
            status=Video.Status.PUBLISHED
        )

        if user.is_authenticated:
            queryset = queryset.filter(
                models.Q(visibility=Video.Visibility.PUBLIC)
                | models.Q(visibility=Video.Visibility.UNLISTED)
                | models.Q(owner=user)
            )
        else:
            queryset = queryset.filter(
                visibility=Video.Visibility.PUBLIC
            )

        return get_object_or_404(
            queryset,
            id=self.kwargs["video_id"],
        )

    def get_queryset(self):
        video = self.get_video()

        return Comment.objects.filter(
            video=video,
            parent__isnull=True,
        ).select_related("user").prefetch_related("replies__user")

    def perform_create(self, serializer):
        video = self.get_video()
        parent = serializer.validated_data.get("parent")

        if parent and parent.video_id != video.id:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({
                "parent": "Parent comment must belong to the same video."
            })

        serializer.save(
            video=video,
            user=self.request.user,
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
        ).prefetch_related("replies__user")


class CommentReactionView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, comment_id):

        comment = get_object_or_404(
            Comment,
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
                existing_reaction.delete()
                user_reaction = None

            else:
                existing_reaction.reaction = reaction_type
                existing_reaction.save(
                    update_fields=["reaction", "updated_at"]
                )
                user_reaction = reaction_type

        else:
            CommentReaction.objects.create(
                comment=comment,
                user=request.user,
                reaction=reaction_type,
            )
            user_reaction = reaction_type

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
            notifications,
            many=True,
        )

        unread_count = notifications.filter(
            is_read=False
        ).count()

        return Response({
            "notifications": serializer.data,
            "unread_count": unread_count,
        })

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