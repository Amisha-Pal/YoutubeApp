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
  } catch (error) {
    console.error("Unable to decode user ID:", error);
    return null;
  }
}