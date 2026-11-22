from django.contrib import admin

from .models import ChannelProfile


@admin.register(ChannelProfile)
class ChannelProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "created_at", "updated_at")
    search_fields = ("user__username", "description")
