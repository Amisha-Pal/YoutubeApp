import math
import os
import shutil
import subprocess
from celery import shared_task
from django.core.files import File
from .models import (
    Video,
    Notification,
    Subscription,
    NotificationPreference,
)
from .notification_utils import send_notification_to_user

FFPROBE_PATH = (
    shutil.which("ffprobe")
    or r"D:\FFmpeg-Windows\ffmpeg-9.0.2-essentials_build\bin\ffprobe.exe"
)

FFMPEG_PATH = (
    shutil.which("ffmpeg")
    or r"D:\FFmpeg-Windows\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe"
)

@shared_task
def test_celery_task():
    print("Celery background task executed successfully!")
    return "Celery is working!"

def generate_video_thumbnail(video):
    """Generate a thumbnail from the uploaded video."""

    if video.thumbnail:
        return "Existing thumbnail preserved."

    video_path = video.video_file.path

    thumbnail_dir = os.path.join(
        os.path.dirname(video_path),
        "generated_thumbnails",
    )

    os.makedirs(thumbnail_dir, exist_ok=True)

    thumbnail_path = os.path.join(
        thumbnail_dir,
        f"video_{video.id}.jpg",
    )

    timestamp = min(5, max(0, video.duration // 2))

    subprocess.run(
        [
            FFMPEG_PATH,
            "-y",
            "-ss", str(timestamp),
            "-i", video_path,
            "-frames:v", "1",
            "-vf",
            "scale=1280:720:force_original_aspect_ratio=decrease,"
            "pad=1280:720:(ow-iw)/2:(oh-ih)/2",
            "-q:v", "2",
            thumbnail_path,
        ],
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )

    if not os.path.exists(thumbnail_path):
        raise FileNotFoundError("Generated thumbnail was not created.")

    with open(thumbnail_path, "rb") as thumbnail_file:
        video.thumbnail.save(
            f"video_{video.id}.jpg",
            File(thumbnail_file),
            save=False,
        )

    video.save(update_fields=["thumbnail"])
    os.remove(thumbnail_path)
    return "Thumbnail generated successfully."

def generate_video_qualities(video):
    """Generate multiple MP4 resolutions using FFmpeg."""

    video_path = video.video_file.path

    # Original video resolution detect karo
    probe = subprocess.run(
        [
            FFPROBE_PATH,
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "json",
            video_path,
        ],
        capture_output=True,
        text=True,
        check=True,
        timeout=60,
    )

    import json
    video_info = json.loads(probe.stdout)

    streams = video_info.get("streams", [])

    if not streams:
        raise ValueError("Video stream not found.")

    original_width = int(streams[0]["width"])
    original_height = int(streams[0]["height"])

    # Available qualities
    quality_options = [
        ("360p", 360),
        ("480p", 480),
        ("720p", 720),
        ("1080p", 1080),
    ]

    output_dir = os.path.join(
        os.path.dirname(video_path),
        "qualities",
        str(video.id),
    )

    os.makedirs(output_dir, exist_ok=True)

    generated = {}

    for label, target_height in quality_options:

        if original_height < target_height:
            continue

        output_path = os.path.join(
            output_dir,
            f"{label}.mp4",
        )

        subprocess.run(
            [
                FFMPEG_PATH,
                "-y",
                "-i", video_path,
                "-vf",
                f"scale=-2:{target_height}:force_divisible_by=2",
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                output_path,
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=3600,
        )

        quality_file_name = os.path.join(
            os.path.dirname(video.video_file.name),
            "qualities",
            str(video.id),
            f"{label}.mp4",
        ).replace("\\", "/")

        generated[label] = video.video_file.storage.url(
            quality_file_name
        )

    video.video_qualities = generated
    video.save(update_fields=["video_qualities"])

    return generated

@shared_task
def process_uploaded_video(video_id):
    video = None

    try:
        video = Video.objects.select_related("owner").get(id=video_id)

        if not video.video_file:
            video.status = Video.Status.FAILED
            video.save(update_fields=["status"])
            return "Video file not found."

        if not video.video_file.storage.exists(video.video_file.name):
            video.status = Video.Status.FAILED
            video.save(update_fields=["status"])
            return "Video file does not exist on storage."

        already_published = (
            video.status == Video.Status.PUBLISHED
        )

        # Extract actual video duration using FFprobe.
        result = subprocess.run(
            [
                FFPROBE_PATH,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video.video_file.path,
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=60,
        )

        duration_seconds = float(result.stdout.strip())

        if not math.isfinite(duration_seconds) or duration_seconds <= 0:
            raise ValueError("Invalid video duration.")

        video.duration = math.ceil(duration_seconds)
        # Generate thumbnail if user did not upload one.
        thumbnail_message = generate_video_thumbnail(video)

        # Generate multiple video resolutions.
        quality_results = generate_video_qualities(video)

        # Publish only after successful processing.
        video.status = Video.Status.PUBLISHED
        video.save(update_fields=["duration", "status"])

        # Owner may have changed visibility while processing ran.
        video.refresh_from_db(fields=["visibility", "title"])

                # Notify only subscribers who have enabled new video notifications.
        if (
            not already_published
            and video.visibility == Video.Visibility.PUBLIC
        ):
            subscriber_ids = list(
                Subscription.objects.filter(
                    channel=video.owner
                ).values_list("subscriber_id", flat=True)
            )

            # Find subscribers who have explicitly disabled new video alerts.
            disabled_subscriber_ids = set(
                NotificationPreference.objects.filter(
                    user_id__in=subscriber_ids,
                    new_video=False,
                ).values_list("user_id", flat=True)
            )

            # Subscribers without preferences are enabled by default.
            enabled_subscriber_ids = [
                subscriber_id
                for subscriber_id in subscriber_ids
                if subscriber_id not in disabled_subscriber_ids
            ]

            notifications = [
                Notification(
                    recipient_id=subscriber_id,
                    sender=video.owner,
                    video=video,
                    notification_type=Notification.NotificationType.NEW_VIDEO,
                    message=(
                        f"{video.owner.username} uploaded a new video: "
                        f"{video.title}"
                    ),
                )
                for subscriber_id in enabled_subscriber_ids
            ]

            if notifications:
                Notification.objects.bulk_create(notifications)

                for notification in notifications:
                    send_notification_to_user(notification)

        return (
            f"Video {video_id} processed successfully. "
            f"Duration: {video.duration} seconds. "
            f"Qualities generated: {', '.join(quality_results.keys()) or 'None'}. "
            f"{thumbnail_message}"
        )

    except Video.DoesNotExist:
        return f"Video {video_id} does not exist."

    except Exception as error:
        if video is not None:
            video.status = Video.Status.FAILED
            video.save(update_fields=["status"])

        return f"Video processing failed: {str(error)}"
