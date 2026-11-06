from django.conf import settings
from django.db import models

class Video(models.Model):

    class Status(models.TextChoices):
        PROCESSING = "processing", "Processing"
        PUBLISHED = "published", "Published"
        FAILED = "failed", "Failed"

    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"
        UNLISTED = "unlisted", "Unlisted"

    class Category(models.TextChoices):
        EDUCATION = "Education", "Education"
        GAMING = "Gaming", "Gaming"
        MUSIC = "Music", "Music"
        ENTERTAINMENT = "Entertainment", "Entertainment"
        TECHNOLOGY = "Technology", "Technology"
        SPORTS = "Sports", "Sports"
        TRAVEL = "Travel", "Travel"
        NEWS = "News", "News"
        OTHER = "Other", "Other"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="videos",
    )

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.OTHER,
    )

    visibility = models.CharField(
        max_length=10,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
    )

    video_file = models.FileField(
        upload_to="videos/",
        blank=True,
        null=True,
    )

    thumbnail = models.ImageField(
        upload_to="thumbnails/",
        blank=True,
        null=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PROCESSING,
    )

    views_count = models.PositiveBigIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

class VideoReaction(models.Model):

    class ReactionType(models.TextChoices):
        LIKE = "like", "Like"
        DISLIKE = "dislike", "Dislike"

    video = models.ForeignKey(
        Video,
        on_delete=models.CASCADE,
        related_name="reactions",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="video_reactions",
    )

    reaction = models.CharField(
        max_length=10,
        choices=ReactionType.choices,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["video", "user"],
                name="unique_video_user_reaction",
            )
        ]

    def __str__(self):
        return f"{self.user} - {self.video} - {self.reaction}"