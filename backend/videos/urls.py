from django.urls import path
from .views import (
    VideoListCreateView,
    VideoDetailView,
    VideoViewCountView,
    VideoReactionView,
    CommentListCreateView,
    CommentDetailView,
    CommentReactionView,
    SubscriptionView,
    NotificationListView,
    NotificationMarkReadView,
)

app_name = "videos"

urlpatterns = [
    path("", VideoListCreateView.as_view(), name="video-list-create"),
    path("<int:video_id>/", VideoDetailView.as_view(), name="video-detail"),
    path("<int:video_id>/view/", VideoViewCountView.as_view(), name="video-view-count"),
    path("<int:video_id>/reaction/", VideoReactionView.as_view(), name="video-reaction"),
    path("<int:video_id>/comments/", CommentListCreateView.as_view(), name="comment-list-create"),
    path("comments/<int:comment_id>/", CommentDetailView.as_view(), name="comment-detail"),
    path("comments/<int:comment_id>/reaction/", CommentReactionView.as_view(), name="comment-reaction",),
    path("channels/<int:channel_id>/subscribe/", SubscriptionView.as_view(), name="channel-subscription"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/<int:notification_id>/read/", NotificationMarkReadView.as_view(), name="notification-mark-read"),
]

