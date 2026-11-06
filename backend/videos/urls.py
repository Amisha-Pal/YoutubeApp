from django.urls import path
from .views import (
    VideoListCreateView,
    VideoDetailView,
    VideoViewCountView,
    VideoReactionView,
)

app_name = "videos"

urlpatterns = [
    path("", VideoListCreateView.as_view(), name="video-list-create"),
    path("<int:video_id>/", VideoDetailView.as_view(), name="video-detail"),
    path("<int:video_id>/view/", VideoViewCountView.as_view(), name="video-view-count"),
    path("<int:video_id>/reaction/", VideoReactionView.as_view(), name="video-reaction"),
]

