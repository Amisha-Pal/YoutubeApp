from celery import shared_task
from .models import Video

@shared_task
def test_celery_task():
    print("Celery background task executed successfully!")
    return "Celery is working!"

@shared_task
def process_uploaded_video(video_id):
    try:
        video = Video.objects.get(id=video_id)

        if not video.video_file:
            video.status = Video.Status.FAILED
            video.save(update_fields=["status"])
            return "Video file not found."

        # Temporary placeholder.
        # Actual video processing will be implemented later.
        video.status = Video.Status.PUBLISHED
        video.save(update_fields=["status"])

        return f"Video {video_id} processed successfully."

    except Video.DoesNotExist:
        return f"Video {video_id} does not exist."