import { useEffect, useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import axiosClient from "../api/axiosClient";

export default function NotificationPanel({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchNotifications() {
    try {
      setLoading(true);
      setError("");

      const response = await axiosClient.get("videos/notifications/");

      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (err) {
      console.error("Notification error:", err);
      setError("Notifications load nahi ho payi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  async function markAsRead(id) {
    try {
      await axiosClient.post(`videos/notifications/${id}/read/`);

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, is_read: true } : item
        )
      );

      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (err) {
      console.error("Mark read error:", err);
    }
  }

  async function markAllAsRead() {
    const unreadNotifications = notifications.filter(
      (item) => !item.is_read
    );

    for (const notification of unreadNotifications) {
      await markAsRead(notification.id);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="notification-backdrop" onClick={onClose} />

      <section
        className="notification-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
      >
        <header className="notification-panel-header">
          <h2>Notifications</h2>

          <div className="notification-header-actions">
            <button
              type="button"
              className="icon-button"
              aria-label="Mark all as read"
              title="Mark all as read"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck size={20} />
            </button>

            <button
              type="button"
              className="icon-button"
              aria-label="Close notifications"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="notification-list">
          {loading ? (
            <p className="notification-empty">Loading notifications...</p>
          ) : error ? (
            <p className="notification-empty">{error}</p>
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                className={`notification-item ${
                  !notification.is_read ? "unread" : ""
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <span className="notification-avatar">
                  <Bell size={20} />
                </span>

                <span className="notification-content">
                  <strong>
                    {notification.sender_username || "Notification"}
                  </strong>

                  <span>{notification.message}</span>

                  <small>
                    {notification.video_title || "New notification"}
                  </small>
                </span>

                {!notification.is_read && (
                  <span
                    className="notification-unread-dot"
                    aria-label="Unread"
                  />
                )}
              </button>
            ))
          ) : (
            <div className="notification-empty">
              <Bell size={38} />
              <p>No notifications</p>
            </div>
          )}
        </div>

        <footer className="notification-panel-footer">
          <span>{unreadCount} unread</span>

          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </button>
        </footer>
      </section>
    </>
  );
}