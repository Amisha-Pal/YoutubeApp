import axios from "axios";
import { API_BASE_URL } from "../api/config";

export const AUTH_CHANGED_EVENT = "app:auth-changed";

export function isLoggedIn() {
  return Boolean(localStorage.getItem("accessToken"));
}

export function getCurrentUserId() {
  const token = localStorage.getItem("accessToken");

  if (!token) return null;

  try {
    const payload = token
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const paddedPayload = payload.padEnd(
      Math.ceil(payload.length / 4) * 4,
      "="
    );

    const decodedPayload = JSON.parse(atob(paddedPayload));

    return decodedPayload.user_id || null;
  } catch {
    return null;
  }
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export async function logout() {
  const accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");

  if (accessToken && refreshToken) {
    try {
      await axios.post(
        `${API_BASE_URL}accounts/logout/`,
        { refresh: refreshToken },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch {
      // Token may already be expired; local sign-out still proceeds.
    }
  }

  clearTokens();
}
