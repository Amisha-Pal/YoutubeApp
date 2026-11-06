from django.db import models, transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Video, VideoReaction
from .serializers import VideoSerializer

class VideoListCreateView(generics.ListCreateAPIView):
    serializer_class = VideoSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = Video.objects.filter(
            status=Video.Status.PUBLISHED,
            visibility=Video.Visibility.PUBLIC,
        )

        return queryset.select_related("owner")

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