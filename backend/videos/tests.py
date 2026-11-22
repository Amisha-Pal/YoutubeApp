import shutil
import tempfile
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    Comment,
    CommentReaction,
    Notification,
    Playlist,
    Subscription,
    Video,
)

User = get_user_model()
TEMP_MEDIA = tempfile.mkdtemp()


def make_video(owner, title="Video", visibility=Video.Visibility.PUBLIC,
               status_=Video.Status.PUBLISHED, **extra):
    return Video.objects.create(
        owner=owner,
        title=title,
        visibility=visibility,
        status=status_,
        video_file=SimpleUploadedFile(f"{title}.mp4", b"fake-video", content_type="video/mp4"),
        **extra,
    )


def results(response):
    data = response.data
    return data["results"] if isinstance(data, dict) and "results" in data else data


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class BaseTestCase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user("owner", "owner@example.com", "Str0ngPass!word")
        self.viewer = User.objects.create_user("viewer", "viewer@example.com", "Str0ngPass!word")
        self.public = make_video(self.owner, "Public", category="Music")
        self.unlisted = make_video(self.owner, "Unlisted", visibility=Video.Visibility.UNLISTED)
        self.private = make_video(self.owner, "Private", visibility=Video.Visibility.PRIVATE)
        self.processing = make_video(self.owner, "Processing", status_=Video.Status.PROCESSING)


class VideoListTests(BaseTestCase):
    def test_list_only_public_published(self):
        response = self.client.get(reverse("videos:video-list-create"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([v["id"] for v in results(response)], [self.public.id])

    def test_search_category_and_sort(self):
        make_video(self.owner, "Guitar lesson", category="Education", views_count=50)
        url = reverse("videos:video-list-create")
        self.assertEqual(len(results(self.client.get(url, {"search": "guitar"}))), 1)
        self.assertEqual(len(results(self.client.get(url, {"category": "Music"}))), 1)
        popular = results(self.client.get(url, {"sort": "popular"}))
        self.assertEqual(popular[0]["title"], "Guitar lesson")
        make_video(self.owner, "Quick clip", duration=30)
        shorts = results(self.client.get(url, {"duration": "short"}))
        self.assertEqual([v["title"] for v in shorts], ["Quick clip"])
        trending = results(self.client.get(url, {"sort": "trending"}))
        self.assertEqual(trending[0]["title"], "Guitar lesson")

    def test_list_counts_and_user_reaction(self):
        self.client.force_authenticate(self.viewer)
        self.client.post(reverse("videos:video-reaction", args=[self.public.id]), {"reaction": "like"})
        item = results(self.client.get(reverse("videos:video-list-create")))[0]
        self.assertEqual(item["likes_count"], 1)
        self.assertEqual(item["user_reaction"], "like")


class VideoDetailTests(BaseTestCase):
    def detail(self, video):
        return reverse("videos:video-detail", args=[video.id])

    def test_anonymous_access(self):
        self.assertEqual(self.client.get(self.detail(self.public)).status_code, 200)
        self.assertEqual(self.client.get(self.detail(self.unlisted)).status_code, 200)
        self.assertEqual(self.client.get(self.detail(self.private)).status_code, 404)

    def test_owner_sees_private_and_processing(self):
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(self.detail(self.private)).status_code, 200)
        self.assertEqual(self.client.get(self.detail(self.processing)).status_code, 200)

    def test_owner_can_edit_and_delete(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch(
            self.detail(self.public),
            {"title": "Renamed", "visibility": "unlisted"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.public.refresh_from_db()
        self.assertEqual(self.public.title, "Renamed")
        self.assertEqual(self.public.visibility, "unlisted")

        response = self.client.delete(self.detail(self.public))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Video.objects.filter(id=self.public.id).exists())

    def test_non_owner_cannot_edit_or_delete(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.patch(self.detail(self.public), {"title": "Hacked"}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.delete(self.detail(self.public)).status_code, 404)
        self.client.logout()
        self.assertEqual(self.client.delete(self.detail(self.public)).status_code, 401)

    def test_view_count_public_and_unlisted(self):
        for video in (self.public, self.unlisted):
            response = self.client.post(reverse("videos:video-view-count", args=[video.id]))
            self.assertEqual(response.data["views_count"], 1)
        response = self.client.post(reverse("videos:video-view-count", args=[self.private.id]))
        self.assertEqual(response.status_code, 404)


class UploadTests(BaseTestCase):
    @mock.patch("videos.tasks.process_uploaded_video.delay")
    def test_upload_creates_processing_video(self, delay):
        self.client.force_authenticate(self.viewer)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("videos:video-list-create"),
                {
                    "title": "My upload",
                    "description": "desc",
                    "category": "Gaming",
                    "visibility": "public",
                    "video_file": SimpleUploadedFile("clip.mp4", b"data", content_type="video/mp4"),
                },
                format="multipart",
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], "processing")
        delay.assert_called_once_with(response.data["id"])

    def test_upload_rejects_bad_extension_and_anonymous(self):
        url = reverse("videos:video-list-create")
        payload = {
            "title": "Bad",
            "video_file": SimpleUploadedFile("clip.exe", b"data"),
        }
        self.assertEqual(self.client.post(url, payload, format="multipart").status_code, 401)
        self.client.force_authenticate(self.viewer)
        payload["video_file"] = SimpleUploadedFile("clip.exe", b"data")
        response = self.client.post(url, payload, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("video_file", response.data)

    def test_my_videos_includes_all_statuses(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(reverse("videos:my-videos"))
        self.assertEqual(len(results(response)), 4)
        self.client.force_authenticate(self.viewer)
        self.assertEqual(len(results(self.client.get(reverse("videos:my-videos")))), 0)


class ReactionTests(BaseTestCase):
    def test_like_toggle_switch_and_notification(self):
        self.client.force_authenticate(self.viewer)
        url = reverse("videos:video-reaction", args=[self.public.id])
        response = self.client.post(url, {"reaction": "like"})
        self.assertEqual((response.data["likes_count"], response.data["user_reaction"]), (1, "like"))
        self.assertTrue(
            Notification.objects.filter(recipient=self.owner, notification_type="new_like").exists()
        )
        response = self.client.post(url, {"reaction": "dislike"})
        self.assertEqual((response.data["likes_count"], response.data["dislikes_count"]), (0, 1))
        response = self.client.post(url, {"reaction": "dislike"})
        self.assertIsNone(response.data["user_reaction"])
        self.assertEqual(self.client.post(url, {"reaction": "love"}).status_code, 400)

    def test_can_react_to_unlisted(self):
        self.client.force_authenticate(self.viewer)
        url = reverse("videos:video-reaction", args=[self.unlisted.id])
        self.assertEqual(self.client.post(url, {"reaction": "like"}).status_code, 200)

    def test_liked_videos(self):
        self.client.force_authenticate(self.viewer)
        self.client.post(reverse("videos:video-reaction", args=[self.public.id]), {"reaction": "like"})
        self.client.post(reverse("videos:video-reaction", args=[self.unlisted.id]), {"reaction": "dislike"})
        liked = results(self.client.get(reverse("videos:liked-videos")))
        self.assertEqual([v["id"] for v in liked], [self.public.id])


class CommentTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.comments_url = reverse("videos:comment-list-create", args=[self.public.id])

    def test_comment_reply_and_notifications(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.post(self.comments_url, {"content": "Nice!"})
        self.assertEqual(response.status_code, 201)
        parent_id = response.data["id"]

        self.client.force_authenticate(self.owner)
        response = self.client.post(self.comments_url, {"content": "Thanks", "parent": parent_id})
        self.assertEqual(response.status_code, 201)

        listing = results(self.client.get(self.comments_url))
        self.assertEqual(len(listing), 1)
        self.assertEqual(listing[0]["replies"][0]["content"], "Thanks")
        self.assertTrue(Notification.objects.filter(recipient=self.owner, notification_type="new_comment").exists())
        self.assertTrue(Notification.objects.filter(recipient=self.viewer, notification_type="new_reply").exists())

    def test_empty_comment_rejected(self):
        self.client.force_authenticate(self.viewer)
        self.assertEqual(self.client.post(self.comments_url, {"content": "   "}).status_code, 400)

    def test_comment_reaction_create_toggle(self):
        comment = Comment.objects.create(video=self.public, user=self.owner, content="Hi")
        self.client.force_authenticate(self.viewer)
        url = reverse("videos:comment-reaction", args=[comment.id])
        response = self.client.post(url, {"reaction": "like"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["likes_count"], 1)
        self.assertTrue(CommentReaction.objects.filter(comment=comment, user=self.viewer).exists())
        self.assertTrue(Notification.objects.filter(recipient=self.owner, notification_type="new_like").exists())
        response = self.client.post(url, {"reaction": "like"})
        self.assertEqual(response.data["likes_count"], 0)

        listing = results(self.client.get(self.comments_url))
        self.assertEqual(listing[0]["likes_count"], 0)

    def test_edit_and_delete_permissions(self):
        comment = Comment.objects.create(video=self.public, user=self.viewer, content="Mine")
        url = reverse("videos:comment-detail", args=[comment.id])
        stranger = User.objects.create_user("stranger", "s@example.com", "Str0ngPass!word")

        self.client.force_authenticate(stranger)
        self.assertEqual(self.client.patch(url, {"content": "x"}).status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)

        # Video owner can moderate (delete) but not edit.
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(url, {"content": "x"}).status_code, 403)

        self.client.force_authenticate(self.viewer)
        self.assertEqual(self.client.patch(url, {"content": "Edited"}).status_code, 200)

        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.delete(url).status_code, 204)

    def test_comments_hidden_for_private_video(self):
        url = reverse("videos:comment-list-create", args=[self.private.id])
        self.assertEqual(self.client.get(url).status_code, 404)


class SubscriptionTests(BaseTestCase):
    def test_subscribe_feed_and_unsubscribe(self):
        url = reverse("videos:channel-subscription", args=[self.owner.id])
        self.client.force_authenticate(self.viewer)
        response = self.client.post(url)
        self.assertEqual((response.data["is_subscribed"], response.data["subscribers_count"]), (True, 1))
        self.assertTrue(Notification.objects.filter(recipient=self.owner, notification_type="new_subscriber").exists())

        feed = results(self.client.get(reverse("videos:subscription-feed")))
        self.assertEqual([v["id"] for v in feed], [self.public.id])
        channels = self.client.get(reverse("videos:subscribed-channels")).data
        self.assertEqual(channels[0]["username"], "owner")
        self.assertEqual(channels[0]["subscribers_count"], 1)

        response = self.client.delete(url)
        self.assertFalse(response.data["is_subscribed"])
        self.assertEqual(len(results(self.client.get(reverse("videos:subscription-feed")))), 0)

    def test_cannot_subscribe_to_self(self):
        self.client.force_authenticate(self.owner)
        url = reverse("videos:channel-subscription", args=[self.owner.id])
        self.assertEqual(self.client.post(url).status_code, 400)

    def test_channel_profile_videos_and_search(self):
        Subscription.objects.create(subscriber=self.viewer, channel=self.owner)
        profile = self.client.get(reverse("videos:channel-profile", args=[self.owner.id])).data
        self.assertEqual((profile["subscribers_count"], profile["videos_count"]), (1, 1))
        videos = results(self.client.get(reverse("videos:channel-videos", args=[self.owner.id])))
        self.assertEqual([v["id"] for v in videos], [self.public.id])
        found = results(self.client.get(reverse("videos:channel-search"), {"search": "own"}))
        self.assertEqual(found[0]["username"], "owner")


class NotificationTests(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.n1 = Notification.objects.create(
            recipient=self.owner, sender=self.viewer, notification_type="new_like", message="a"
        )
        self.n2 = Notification.objects.create(
            recipient=self.owner, sender=self.viewer, notification_type="new_comment", message="b"
        )

    def test_list_mark_read_delete(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(reverse("videos:notification-list"))
        self.assertEqual(response.data["unread_count"], 2)
        self.client.post(reverse("videos:notification-mark-read", args=[self.n1.id]))
        self.assertEqual(self.client.get(reverse("videos:notification-list")).data["unread_count"], 1)
        self.client.post(reverse("videos:notification-mark-all-read"))
        self.assertEqual(self.client.get(reverse("videos:notification-list")).data["unread_count"], 0)
        self.assertEqual(self.client.delete(reverse("videos:notification-delete", args=[self.n2.id])).status_code, 200)

    def test_list_pagination_and_status_filter(self):
        for index in range(25):
            Notification.objects.create(
                recipient=self.owner,
                sender=self.viewer,
                notification_type="new_like",
                message=f"extra {index}",
                is_read=index % 2 == 0,
            )
        self.client.force_authenticate(self.owner)
        url = reverse("videos:notification-list")

        first = self.client.get(url).data
        self.assertEqual(len(first["notifications"]), 20)
        self.assertTrue(first["has_more"])
        self.assertEqual(first["unread_count"], 14)

        second = self.client.get(url, {"page": 2}).data
        self.assertEqual(len(second["notifications"]), 7)
        self.assertFalse(second["has_more"])
        ids = {n["id"] for n in first["notifications"]} | {n["id"] for n in second["notifications"]}
        self.assertEqual(len(ids), 27)

        unread = self.client.get(url, {"status": "unread", "page_size": 10}).data
        self.assertEqual(len(unread["notifications"]), 10)
        self.assertTrue(all(not n["is_read"] for n in unread["notifications"]))
        unread_2 = self.client.get(url, {"status": "unread", "page_size": 10, "page": 2}).data
        self.assertEqual(len(unread_2["notifications"]), 4)
        self.assertFalse(unread_2["has_more"])

        read = self.client.get(url, {"status": "read", "page_size": 100}).data
        self.assertEqual(len(read["notifications"]), 13)
        self.assertEqual(self.client.get(url, {"page": "x"}).status_code, 400)

        cursor_id = first["notifications"][-1]["id"]
        Notification.objects.create(
            recipient=self.owner, sender=self.viewer, notification_type="new_like", message="newer"
        )
        after = self.client.get(url, {"before": cursor_id, "page_size": 100}).data
        self.assertEqual({n["id"] for n in after["notifications"]}, {n["id"] for n in second["notifications"]})
        self.assertEqual(self.client.get(url, {"before": 999999}).status_code, 400)

    def test_cannot_touch_others_notifications(self):
        self.client.force_authenticate(self.viewer)
        self.assertEqual(self.client.post(reverse("videos:notification-mark-read", args=[self.n1.id])).status_code, 404)
        self.assertEqual(self.client.delete(reverse("videos:notification-delete", args=[self.n1.id])).status_code, 404)

    def test_preferences_disable_notifications(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch(reverse("videos:notification-preferences"), {"new_like": False}, format="json")
        self.assertFalse(response.data["new_like"])
        self.client.force_authenticate(self.viewer)
        self.client.post(reverse("videos:video-reaction", args=[self.public.id]), {"reaction": "like"})
        self.assertEqual(Notification.objects.filter(recipient=self.owner, notification_type="new_like").count(), 1)


class PlaylistTests(BaseTestCase):
    def test_playlist_lifecycle(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.post(reverse("videos:playlist-list-create"), {"title": "Faves", "visibility": "private"})
        self.assertEqual(response.status_code, 201)
        playlist_id = response.data["id"]
        add_url = reverse("videos:playlist-add-video", args=[playlist_id])
        second = make_video(self.owner, "Second")
        self.assertEqual(self.client.post(add_url, {"video_id": self.public.id}).status_code, 201)
        self.assertEqual(self.client.post(add_url, {"video_id": second.id}).status_code, 201)
        self.assertEqual(self.client.post(add_url, {"video_id": self.public.id}).status_code, 400)
        # Another user's private video cannot be added.
        self.assertEqual(self.client.post(add_url, {"video_id": self.private.id}).status_code, 403)

        reorder_url = reverse("videos:playlist-reorder", args=[playlist_id])
        self.assertEqual(self.client.post(reorder_url, {"video_ids": [second.id, self.public.id]}, format="json").status_code, 200)
        detail = self.client.get(reverse("videos:playlist-detail", args=[playlist_id])).data
        self.assertEqual([item["video"] for item in detail["videos"]], [second.id, self.public.id])
        self.assertEqual(detail["videos_count"], 2)

        remove_url = reverse("videos:playlist-remove-video", args=[playlist_id, second.id])
        self.assertEqual(self.client.delete(remove_url).status_code, 200)

        mine = results(self.client.get(reverse("videos:playlist-list-create"), {"owner": "me"}))
        self.assertEqual(len(mine), 1)

        # Private playlist hidden from others; others cannot delete it.
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(reverse("videos:playlist-detail", args=[playlist_id])).status_code, 404)
        self.assertEqual(self.client.delete(reverse("videos:playlist-detail", args=[playlist_id])).status_code, 404)

        self.client.force_authenticate(self.viewer)
        self.assertEqual(self.client.delete(reverse("videos:playlist-detail", args=[playlist_id])).status_code, 204)
        self.assertFalse(Playlist.objects.filter(id=playlist_id).exists())


class MediaRangeTests(BaseTestCase):
    def test_range_request(self):
        from django.test import RequestFactory

        from config.media_views import serve_media

        request = RequestFactory().get("/media/x", HTTP_RANGE="bytes=0-3")
        response = serve_media(request, self.public.video_file.name)
        self.assertEqual(response.status_code, 206)
        self.assertEqual(b"".join(response.streaming_content), b"fake")
        self.assertEqual(response["Accept-Ranges"], "bytes")

    def test_path_traversal_blocked(self):
        from django.test import RequestFactory

        from config.media_views import serve_media

        response = serve_media(RequestFactory().get("/media/x"), "../config/settings.py")
        self.assertEqual(response.status_code, 404)
