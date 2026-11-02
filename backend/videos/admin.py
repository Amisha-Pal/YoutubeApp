
from django.contrib import admin
from .models import Video

@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "owner",
        "status",
        "views_count",
        "created_at",
    )

    list_filter = ("status", "created_at")
    search_fields = ("title", "description", "owner__username")
    readonly_fields = ("created_at", "updated_at")

