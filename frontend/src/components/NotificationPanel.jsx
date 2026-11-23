import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  X,
  Video,
  MessageCircle,
  UserPlus,
  Trash2,
  Volume2,
  VolumeX,
  Settings,
  ThumbsUp,
} from "lucide-react";
import axiosClient from "../api/axiosClient";

const NOTIFICATION_PAGE_SIZE = 20;

function formatNotificationTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }

  const days = Math.floor(hours / 24);

  if (days === 1) return "Yesterday";

  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString();
}

function NotificationTypeIcon({ type }) {
  const Icon =
    type === "new_video"
      ? Video
      : type === "new_comment" || type === "new_reply"
        ? MessageCircle
        : type === "new_subscriber"
          ? UserPlus
          : type === "new_like"
            ? ThumbsUp
            : Bell;

  return <Icon size={20} />;
}

export default function NotificationPanel({
  isOpen,
  onClose,
  onUnreadCountChange,
  soundEnabled,
  onSoundToggle,
  preferences,
  onPreferenceChange,
}) {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Re-render every minute so relative times ("5 min ago") stay fresh.
  const [, setClockTick] = useState(0);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const statusParam = activeFilter === "all" ? undefined : activeFilter;

  // replace=true loads a fresh first page; otherwise the first page is merged
  // in so older pages loaded with "Load more" are kept during polling.
  const fetchNotifications = useCallback(async (replace = false) => {
    try {
      const response = await axiosClient.get("videos/notifications/", {
        params: { page_size: NOTIFICATION_PAGE_SIZE, status: statusParam },
      });
      const firstPage = response.data.notifications || [];

      setError("");

      if (replace || !response.data.has_more) {
        setNotifications(firstPage);
        setHasMore(Boolean(response.data.has_more));
      } else {
        const firstPageIds = new Set(firstPage.map((item) => item.id));
        const oldest = new Date(firstPage[firstPage.length - 1].created_at);
        setNotifications((previous) => [
          ...firstPage,
          ...previous.filter(
            (item) =>
              !firstPageIds.has(item.id) && new Date(item.created_at) <= oldest
          ),
        ]);
      }
      setUnreadCount(response.data.unread_count || 0);
      onUnreadCountChange?.(response.data.unread_count || 0);
    } catch (err) {
      console.error("Notification error:", err);
      setError("Notifications load nahi ho payi.");
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange, statusParam]);

  async function loadMoreNotifications() {
    try {
      setLoadingMore(true);
      // Page by cursor (oldest loaded item) so realtime arrivals, deletions
      // and read-state changes don't shift which items come next.
      const oldest = notifications[notifications.length - 1];
      const response = await axiosClient.get("videos/notifications/", {
        params: {
          before: oldest?.id,
          page_size: NOTIFICATION_PAGE_SIZE,
          status: statusParam,
        },
      });
      setNotifications((previous) => {
        const seen = new Set(previous.map((item) => item.id));
        return [
          ...previous,
          ...(response.data.notifications || []).filter(
            (item) => !seen.has(item.id)
          ),
        ];
      });
      setHasMore(Boolean(response.data.has_more));
    } catch (err) {
      console.error("Notification error:", err);
      setError("More notifications could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick((tick) => tick + 1);
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const initialTimer = window.setTimeout(() => fetchNotifications(true), 0);

    const intervalId = window.setInterval(() => {
      fetchNotifications();
    }, 15000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalId);
    };
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    function handleNewNotification(event) {
      const newNotification = event.detail;

      if (!newNotification?.id) return;

      setNotifications((previous) => {
        if (previous.some((item) => item.id === newNotification.id)) {
          return previous;
        }

        return [newNotification, ...previous];
      });

      if (!newNotification.is_read) {
        setUnreadCount((previous) => {
          const next = previous + 1;
          onUnreadCountChange?.(next);
          return next;
        });
      }
    }

    window.addEventListener("app:new-notification", handleNewNotification);

    return () => {
      window.removeEventListener(
        "app:new-notification",
        handleNewNotification
      );
    };
  }, [onUnreadCountChange]);


  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === "unread") {
      return !notification.is_read;
    }

    if (activeFilter === "read") {
      return notification.is_read;
    }

    return true;
  });

  async function markAsRead(id) {
    const currentNotification = notifications.find(
      (item) => item.id === id
    );

    if (!currentNotification || currentNotification.is_read) {
      return true;
    }

    try {
      await axiosClient.post(`videos/notifications/${id}/read/`);

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, is_read: true } : item
        )
      );

      const nextUnreadCount = Math.max(0, unreadCount - 1);

      setUnreadCount(nextUnreadCount);
      onUnreadCountChange?.(nextUnreadCount);

      return true;
    } catch (err) {
      console.error("Mark read error:", err);
      return false;
    }
  }

  async function deleteNotification(id) {
    const notification = notifications.find(
      (item) => item.id === id
    );

    if (!notification) return;

    try {
      await axiosClient.delete(`videos/notifications/${id}/`);

      setNotifications((previous) =>
        previous.filter((item) => item.id !== id)
      );

      if (!notification.is_read) {
        const nextUnreadCount = Math.max(0, unreadCount - 1);

        setUnreadCount(nextUnreadCount);
        onUnreadCountChange?.(nextUnreadCount);
      }
    } catch (err) {
      console.error("Delete notification error:", err);
      setError("Notification delete nahi ho payi.");
    }
  }

  async function handleNotificationClick(notification) {
    await markAsRead(notification.id);

    const videoId =
      typeof notification.video === "object"
        ? notification.video?.id
        : notification.video;

    onClose();

    if (videoId) {
      navigate(`/watch/${videoId}`);
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0) return;

    try {
      const response = await axiosClient.post(
        "videos/notifications/mark-all-read/"
      );

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );

      setUnreadCount(response.data.unread_count ?? 0);
      onUnreadCountChange?.(response.data.unread_count ?? 0);
    } catch (error) {
      console.error("Mark all as read error:", error);
      setError("All notifications read nahi ho payi.");
    }
  }

  const preferenceOptions = [
    {
      key: "new_video",
      title: "New Videos",
      description: "Subscribed channels ke naye videos",
    },
    {
      key: "new_comment",
      title: "New Comments",
      description: "Aapke videos par naye comments",
    },
    {
      key: "new_reply",
      title: "New Replies",
      description: "Aapke comments ke replies",
    },
    {
      key: "new_subscriber",
      title: "New Subscribers",
      description: "Jab koi aapke channel ko subscribe kare",
    },
    {
      key: "new_like",
      title: "New Likes",
      description: "Jab koi aapke video ko like kare",
    },
  ];

  function handlePreferenceToggle(key, value) {
    onPreferenceChange?.(key, value);
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
              className={`icon-button ${showSettings ? "active" : ""}`}
              aria-label="Notification settings"
              title="Notification settings"
              onClick={() => setShowSettings((previous) => !previous)}
            >
              <Settings size={20} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={soundEnabled ? "Turn notification sound off" : "Turn notification sound on"}
              title={soundEnabled ? "Sound On" : "Sound Off"}
              onClick={onSoundToggle}
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>

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

        <div className="notification-filters">
          {["all", "unread", "read"].map((filter) => (
            <button
              key={filter}
              type="button"
              className={`notification-filter ${activeFilter === filter ? "active" : ""
                }`}
              onClick={() => {
                if (filter === activeFilter) return;
                setLoading(true);
                setNotifications([]);
                setHasMore(false);
                setActiveFilter(filter);
              }}
            >
              {filter === "all"
                ? "All"
                : filter === "unread"
                  ? "Unread"
                  : "Read"}
            </button>
          ))}
        </div>

        {showSettings && (
          <div className="notification-settings">
            <h3>Notification Settings</h3>

            {preferenceOptions.map((option) => (
              <div className="notification-setting-item" key={option.key}>
                <div className="notification-setting-info">
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </div>

                <label className="notification-switch">
                  <input
                    type="checkbox"
                    checked={Boolean(preferences?.[option.key])}
                    onChange={(event) =>
                      handlePreferenceToggle(
                        option.key,
                        event.target.checked
                      )
                    }
                  />

                  <span className="notification-switch-slider" />
                </label>
              </div>
            ))}

            <div className="notification-setting-item">
              <div className="notification-setting-info">
                <strong>Notification Sound</strong>
                <span>New notification aane par sound play kare</span>
              </div>

              <label className="notification-switch">
                <input
                  type="checkbox"
                  checked={Boolean(soundEnabled)}
                  onChange={onSoundToggle}
                />

                <span className="notification-switch-slider" />
              </label>
            </div>
          </div>
        )}

        <div className="notification-list">
          {loading ? (
            <p className="notification-empty">
              Loading notifications...
            </p>
          ) : error ? (
            <p className="notification-empty">{error}</p>
          ) : filteredNotifications.length > 0 ? (
            <>
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${!notification.is_read ? "unread" : ""
                  }`}
              >
                <button
                  type="button"
                  className="notification-open-button"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <span className="notification-avatar">
                    <NotificationTypeIcon
                      type={notification.notification_type}
                    />
                  </span>

                  <span className="notification-content">
                    <strong>
                      {notification.sender_username || "Notification"}
                    </strong>

                    <span>{notification.message}</span>

                    <small>
                      {notification.video_title || "New notification"}
                    </small>

                    <small className="notification-time">
                      {formatNotificationTime(notification.created_at)}
                    </small>
                  </span>

                  {!notification.is_read && (
                    <span
                      className="notification-unread-dot"
                      aria-label="Unread"
                    />
                  )}
                </button>

                <button
                  type="button"
                  className="notification-delete-button"
                  aria-label="Delete notification"
                  title="Delete notification"
                  onClick={() => deleteNotification(notification.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {hasMore && (
              <div className="notification-load-more">
                <button
                  type="button"
                  className="load-more-btn"
                  onClick={loadMoreNotifications}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
            </>
          ) : (
            <div className="notification-empty">
              <Bell size={38} />
              <p>
                {activeFilter === "unread"
                  ? "No unread notifications"
                  : activeFilter === "read"
                    ? "No read notifications"
                    : "No notifications"}
              </p>
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
