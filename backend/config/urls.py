
from django.contrib import admin
from django.urls import include, path, re_path
from django.conf import settings
from .media_views import serve_media

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/accounts/", include("accounts.urls")),
    path("api/videos/", include("videos.urls")),
]

if settings.DEBUG or settings.SERVE_MEDIA:
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve_media,
            name="serve_media",
        ),
    ]
