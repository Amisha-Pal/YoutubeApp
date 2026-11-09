from celery import shared_task
from .models import Video, Notification, Subscription

@shared_task
def test_celery_task():
    print("Celery background task executed successfully!")
    return "Celery is working!"

@shared_task
def process_uploaded_video(video_id):
    try:
        video = Video.objects.select_related("owner").get(id=video_id)

        if not video.video_file:
            video.status = Video.Status.FAILED
            video.save(update_fields=["status"])
            return "Video file not found."

        # Check karo video pehle se published toh nahi hai.
        already_published = (
            video.status == Video.Status.PUBLISHED
        )    

        # Temporary placeholder.
        # Actual video processing will be implemented later.
        video.status = Video.Status.PUBLISHED
        video.save(update_fields=["status"])
         # Sirf naye public videos ke liye notifications.
        if (
            not already_published
            and video.visibility == Video.Visibility.PUBLIC
        ):
            subscribers = Subscription.objects.filter(
                channel=video.owner
            ).values_list("subscriber_id", flat=True)

            notifications = [
                Notification(
                    recipient_id=subscriber_id,
                    sender=video.owner,
                    video=video,
                    notification_type=Notification.NotificationType.NEW_VIDEO,
                    message=f"{video.owner.username} uploaded a new video: {video.title}",
                )
                for subscriber_id in subscribers
            ]

            Notification.objects.bulk_create(notifications)
        return f"Video {video_id} processed successfully."

    except Video.DoesNotExist:
        return f"Video {video_id} does not exist."