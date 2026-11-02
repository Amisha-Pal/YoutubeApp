from django.urls import path
from .views import VideoListCreateView
from .views import VideoListCreateView, VideoDetailView

app_name = "videos"

urlpatterns = [
    path("", VideoListCreateView.as_view(), name="video-list-create"),
    path("<int:video_id>/", VideoDetailView.as_view(), name="video-detail"),
]

