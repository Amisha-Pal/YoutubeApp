from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class AuthFlowTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_register_login_profile_refresh_logout(self):
        response = self.client.post(
            reverse("accounts:register"),
            {"username": "alice", "email": "alice@example.com", "password": "Str0ngPass!word"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", response.data["user"])

        response = self.client.post(
            reverse("accounts:login"),
            {"username": "alice", "password": "Str0ngPass!word"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        access, refresh = response.data["access"], response.data["refresh"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get(reverse("accounts:profile"))
        self.assertEqual(response.data["username"], "alice")

        response = self.client.post(
            reverse("accounts:token_refresh"), {"refresh": refresh}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rotated_refresh = response.data["refresh"]

        response = self.client.post(
            reverse("accounts:logout"), {"refresh": rotated_refresh}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Blacklisted token can no longer be used.
        response = self.client.post(
            reverse("accounts:token_refresh"), {"refresh": rotated_refresh}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_duplicate_username_rejected(self):
        User.objects.create_user("bob", "bob@example.com", "Str0ngPass!word")
        response = self.client.post(
            reverse("accounts:register"),
            {"username": "bob", "email": "other@example.com", "password": "Str0ngPass!word"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_wrong_password_rejected(self):
        User.objects.create_user("carol", "carol@example.com", "Str0ngPass!word")
        response = self.client.post(
            reverse("accounts:login"),
            {"username": "carol", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_requires_refresh_token(self):
        user = User.objects.create_user("dave", "dave@example.com", "Str0ngPass!word")
        self.client.force_authenticate(user)
        response = self.client.post(reverse("accounts:logout"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_channel_profile_update(self):
        user = User.objects.create_user("erin", "erin@example.com", "Str0ngPass!word")
        self.client.force_authenticate(user)
        response = self.client.patch(
            reverse("accounts:channel-profile"),
            {"description": "Welcome to my channel"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["description"], "Welcome to my channel")

    def test_profile_requires_auth(self):
        response = self.client.get(reverse("accounts:profile"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class PasswordResetTests(APITestCase):
    def test_password_reset_flow(self):
        from django.core import mail
        from urllib.parse import parse_qs, urlparse

        User.objects.create_user("resetme", "reset@example.com", "OldPass123!")
        response = self.client.post(
            "/api/accounts/password-reset/", {"email": "reset@example.com"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        link = next(
            line for line in mail.outbox[0].body.splitlines() if "reset-password" in line
        )
        query = parse_qs(urlparse(link).query)

        bad = self.client.post(
            "/api/accounts/password-reset/confirm/",
            {"uid": query["uid"][0], "token": "bad-token", "new_password": "NewPass456!"},
        )
        self.assertEqual(bad.status_code, 400)

        ok = self.client.post(
            "/api/accounts/password-reset/confirm/",
            {"uid": query["uid"][0], "token": query["token"][0], "new_password": "NewPass456!"},
        )
        self.assertEqual(ok.status_code, 200)
        login = self.client.post(
            "/api/accounts/login/", {"username": "resetme", "password": "NewPass456!"}
        )
        self.assertEqual(login.status_code, 200)

    def test_unknown_email_gets_same_response(self):
        from django.core import mail

        response = self.client.post(
            "/api/accounts/password-reset/", {"email": "nobody@example.com"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
