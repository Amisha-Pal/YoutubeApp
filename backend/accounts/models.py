from django.conf import settings
from django.db import models

class ChannelProfile(models.Model):

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="channel_profile",
    )

    profile_picture = models.ImageField(
        upload_to="channel_profiles/",
        blank=True,
        null=True,
    )

    banner = models.ImageField(
        upload_to="channel_banners/",
        blank=True,
        null=True,
    )

    description = models.TextField(
        blank=True,
        max_length=1000,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Channel"