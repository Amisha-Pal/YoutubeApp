
import { useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";

const initialNotifications = [
  {
    id: 1,
    title: "Welcome to YouTube!",
    message: "Explore videos, music, gaming and more.",
    time: "Just now",
    unread: true,
  },
  {
    id: 2,
    title: "Your recommendations are ready",
    message: "Search for videos to discover content you enjoy.",
    time: "Recently",
    unread: true,
  },
  {
    id: 3,
    title: "Complete your profile",
    message: "Sign in to personalize your YouTube experience.",
    time: "Earlier",
    unread: false,
  },
];

export default function NotificationPanel({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState(
    initialNotifications
  );

  if (!isOpen) return null;

  const unreadCount = notifications.filter(
    (notification) => notification.unread
  ).length;

  function markAllAsRead() {
    setNotifications((previous) =>
      previous.map((notification) => ({
        ...notification,
        unread: false,
      }))
    );
  }

  function markAsRead(id) {
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === id
          ? { ...notification, unread: false }
          : notification
      )
    );
  }

  return (
    <>
      <div
        className="notification-backdrop"
        onClick={onClose}
      />

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
              aria-label="Mark all notifications as read"
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
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                className={`notification-item ${
                  notification.unread ? "unread" : ""
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <span className="notification-avatar">
                  <Bell size={20} />
                </span>

                <span className="notification-content">
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <small>{notification.time}</small>
                </span>

                {notification.unread && (
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

