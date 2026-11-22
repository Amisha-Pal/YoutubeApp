import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import NotificationPreference
from .serializers import NotificationSerializer


logger = logging.getLogger(__name__)


def is_notification_enabled(user, notification_type):
    """
    Check whether the recipient has enabled this notification type.
    """

    preferences, _ = NotificationPreference.objects.get_or_create(
        user=user
    )

    preference_field = {
        "new_video": "new_video",
        "new_comment": "new_comment",
        "new_reply": "new_reply",
        "new_subscriber": "new_subscriber",
        "new_like": "new_like",
    }.get(notification_type)

    if preference_field is None:
        return True

    return getattr(preferences, preference_field, True)


def create_notification(**kwargs):
    """
    Create a notification only if the recipient has enabled it.
    """

    recipient = kwargs["recipient"]
    notification_type = kwargs["notification_type"]

    if not is_notification_enabled(recipient, notification_type):
        return None

    from .models import Notification
    notification = Notification.objects.create(**kwargs)

    return notification


def send_notification_to_user(notification):
    """
    Send notification through WebSocket.
    """

    if notification is None:
        return

    try:
        channel_layer = get_channel_layer()

        if channel_layer is None:
            return

        notification_data = NotificationSerializer(notification).data

        async_to_sync(channel_layer.group_send)(
            f"user_{notification.recipient_id}",
            {
                "type": "send_notification",
                "notification": notification_data,
            },
        )

    except Exception:
        logger.exception("WebSocket notification send failed")
        