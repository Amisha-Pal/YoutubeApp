
import { useState } from "react";
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

export default function Navbar({
  onMenuClick,
  searchQuery = "",
  onSearchChange = () => { },
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  function handleSearch(event) {
    event.preventDefault();

    const query = searchQuery.trim();

    if (!query) return;

    onSearchChange(query);
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
      <div className="navbar-search-area">
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
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
      />
    </header>
  );
}

