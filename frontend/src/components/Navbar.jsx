
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  Mic,
  Video,
  Bell,
  CircleUserRound,
  Play,
  X,
} from "lucide-react";

import UploadModal from "./UploadModal";
import ProfileMenu from "./ProfileMenu";
import NotificationPanel from "./NotificationPanel";
import axiosClient from "../api/axiosClient";

export default function Navbar({
  onMenuClick,
  searchQuery = "",
  onSearchChange = () => { },
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(
    () => localStorage.getItem("notificationSoundEnabled") !== "false"
  );
  const [notificationPreferences, setNotificationPreferences] = useState({
    new_video: true,
    new_comment: true,
    new_reply: true,
    new_subscriber: true,
    new_like: true,
    sound_enabled: true,
  });

  const notificationSoundRef = useRef(notificationSoundEnabled);
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("searchHistory") || "[]");
    } catch {
      return [];
    }
  });

  const searchAreaRef = useRef(null);

  const audioContextRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchNotificationPreferences() {
      try {
        const response = await axiosClient.get(
          "videos/notification-preferences/"
        );

        if (!isMounted) return;

        const preferences = response.data;

        setNotificationPreferences(preferences);

        setNotificationSoundEnabled(preferences.sound_enabled);
        notificationSoundRef.current = preferences.sound_enabled;

        localStorage.setItem(
          "notificationSoundEnabled",
          String(preferences.sound_enabled)
        );
      } catch (error) {
        console.error("Notification preferences error:", error);
      }
    }

    fetchNotificationPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unlockAudio = async () => {
      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
        }

        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }

        console.log("Notification audio enabled!");
      } catch (error) {
        console.error("Audio unlock error:", error);
      }
    };

    window.addEventListener("click", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
    };
  }, []);

  function playNotificationSound() {
    try {
      if (!notificationSoundRef.current) return;
      const audioContext = audioContextRef.current;

      if (!audioContext || audioContext.state !== "running") {
        console.log("Notification audio is not unlocked yet.");
        return;
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(
        880,
        audioContext.currentTime
      );

      gainNode.gain.setValueAtTime(
        0.0001,
        audioContext.currentTime
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.15,
        audioContext.currentTime + 0.02
      );

      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.3
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);

      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };
    } catch (error) {
      console.error("Notification sound error:", error);
    }
  }

  async function handlePreferenceChange(field, value) {
    try {
      const response = await axiosClient.patch(
        "videos/notification-preferences/",
        {
          [field]: value,
        }
      );

      setNotificationPreferences(response.data);

      if (field === "sound_enabled") {
        setNotificationSoundEnabled(value);
        notificationSoundRef.current = value;

        localStorage.setItem(
          "notificationSoundEnabled",
          String(value)
        );
      }
    } catch (error) {
      console.error("Preference update error:", error);
      alert("Notification setting save nahi ho payi.");
    }
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        searchAreaRef.current &&
        !searchAreaRef.current.contains(event.target)
      ) {
        setShowSearchHistory(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function fetchUnreadCount() {
      try {
        const response = await axiosClient.get("videos/notifications/");

        if (isMounted) {
          setUnreadNotificationCount(response.data.unread_count || 0);
        }
      } catch (error) {
        console.error("Unread notification count error:", error);
      }
    }

    fetchUnreadCount();

    const intervalId = window.setInterval(fetchUnreadCount, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  // Real-time WebSocket Notifications
  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) return;

    let socket;
    let reconnectTimer;
    let isMounted = true;

    function connectWebSocket() {
      if (!isMounted) return;

      const token = localStorage.getItem("accessToken");

      if (!token) return;

      socket = new WebSocket(
        `ws://127.0.0.1:8000/ws/notifications/?token=${encodeURIComponent(token)}`
      );

      socket.onopen = () => {
        console.log("Notification WebSocket Connected!");
      };

      socket.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);

          console.log("New Real-time Notification:", notification);

          // Update Navbar badge
          if (!notification.is_read) {
            setUnreadNotificationCount((previous) => previous + 1);
            playNotificationSound();
          }

          // Notify NotificationPanel
          window.dispatchEvent(
            new CustomEvent("app:new-notification", {
              detail: notification,
            })
          );

        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("Notification WebSocket Error:", error);
      };

      socket.onclose = () => {
        console.log("Notification WebSocket Disconnected.");

        if (isMounted) {
          reconnectTimer = window.setTimeout(
            connectWebSocket,
            3000
          );
        }
      };
    }

    const initialConnectTimer = window.setTimeout(
      connectWebSocket,
      100
    );

    return () => {
      isMounted = false;
      window.clearTimeout(initialConnectTimer);
      window.clearTimeout(reconnectTimer);
      if (socket) {
        socket.close();
      }
    };
  }, []);

  function handleSearch(event) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    try {
      const savedHistory = JSON.parse(
        localStorage.getItem("searchHistory") || "[]"
      );

      const updatedHistory = [
        query,
        ...savedHistory.filter(
          (item) => item.toLowerCase() !== query.toLowerCase()
        ),
      ].slice(0, 10);

      localStorage.setItem(
        "searchHistory",
        JSON.stringify(updatedHistory)
      );
      setSearchHistory(updatedHistory);
    } catch (error) {
      console.error("Search history save error:", error);
    }

    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  function clearSearch() {
    onSearchChange("");
  }

  function toggleNotifications() {
    setNotificationsOpen((previous) => !previous);
    setProfileOpen(false);
  }

  return (
    <header className="navbar">
      {/* Left Section */}
      <div className="navbar-left">
        <button
          className="icon-button menu-button"
          aria-label="Toggle sidebar"
          onClick={onMenuClick}
          type="button"
        >
          <Menu size={24} />
        </button>

        <a className="youtube-logo" href="/" aria-label="YouTube Home">
          <span className="youtube-logo-icon">
            <Play size={20} fill="white" />
          </span>

          <span className="youtube-logo-text">YouTube</span>
          <sup>IN</sup>
        </a>
      </div>

      {/* Search Section */}
      <div className="navbar-search-area" ref={searchAreaRef}>
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={() => setShowSearchHistory(true)}
            aria-label="Search videos"
          />

          {searchQuery && (
            <button
              type="button"
              className="clear-search-button"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}

          <button
            type="submit"
            className="search-button"
            aria-label="Search"
          >
            <Search size={22} />
          </button>
        </form>

        {showSearchHistory && searchHistory.length > 0 && (
          <div className="search-history-dropdown">
            <div className="search-history-header">
              <span>Recent searches</span>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  localStorage.removeItem("searchHistory");
                  setSearchHistory([]);
                }}
              >
                Clear all
              </button>
            </div>

            {searchHistory.map((item, index) => (
              <div
                className="search-history-item"
                key={`${item}-${index}`}
              >
                <button
                  type="button"
                  className="search-history-query"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSearchChange(item);
                    setShowSearchHistory(false);
                    navigate(`/search?q=${encodeURIComponent(item)}`);
                  }}
                >
                  <Search size={16} />
                  <span>{item}</span>
                </button>

                <button
                  type="button"
                  className="search-history-delete"
                  aria-label={`Delete ${item}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const updatedHistory = searchHistory.filter(
                      (_, itemIndex) => itemIndex !== index
                    );

                    localStorage.setItem(
                      "searchHistory",
                      JSON.stringify(updatedHistory)
                    );

                    setSearchHistory(updatedHistory);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          className="icon-button mic-button"
          aria-label="Voice search"
          type="button"
          onClick={() => alert("Voice search baad mein add karenge.")}
        >
          <Mic size={21} />
        </button>
      </div>

      {/* Right Section */}
      <div className="navbar-right">
        <button
          className="icon-button create-button"
          type="button"
          onClick={() => {
            setUploadOpen(true);
            setNotificationsOpen(false);
            setProfileOpen(false);
          }}
        >
          <Video size={22} />
          <span>Create</span>
        </button>

        <button
          className="icon-button notification-button"
          aria-label="Notifications"
          aria-expanded={notificationsOpen}
          type="button"
          onClick={toggleNotifications}
        >
          <Bell size={22} />
          {unreadNotificationCount > 0 && (
            <span className="notification-badge">
              {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
            </span>
          )}
        </button>

        <button
          className="profile-button"
          aria-label="Open profile menu"
          aria-expanded={profileOpen}
          type="button"
          onClick={() => {
            setProfileOpen((previous) => !previous);
            setNotificationsOpen(false);
          }}
        >
          <CircleUserRound size={30} />
        </button>
      </div>

      {/* Modals and Panels */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />

      <ProfileMenu
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      <NotificationPanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onUnreadCountChange={setUnreadNotificationCount}
        soundEnabled={notificationSoundEnabled}
        onSoundToggle={() =>
          handlePreferenceChange(
            "sound_enabled",
            !notificationSoundEnabled
          )
        }
        preferences={notificationPreferences}
        onPreferenceChange={handlePreferenceChange}
      />
    </header>
  );
}

