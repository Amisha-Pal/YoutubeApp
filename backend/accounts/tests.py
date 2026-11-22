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
