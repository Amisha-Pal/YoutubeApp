
import { useNavigate } from "react-router-dom";
import {
  Home,
  Clapperboard,
  Tv,
  Clock,
  ListVideo,
  History,
  ThumbsUp,
  Flame,
  Music2,
  Gamepad2,
  Trophy,
  ShoppingBag,
  Settings,
  Flag,
  CircleHelp,
  MessageSquareWarning,
  ChevronRight,
  UserRound,
} from "lucide-react";

import { useWatchLater } from "../context/WatchLaterContext";

const mainLinks = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Shorts", icon: Clapperboard, path: "/shorts" },
  { label: "Subscriptions", icon: Tv, path: "/subscriptions" },
];

const personalLinks = [
  { label: "History", icon: History, path: "/history" },
  { label: "Playlists", icon: ListVideo, path: "/playlists" },
  { label: "Your videos", icon: Clapperboard, path: "/your-videos" },
  { label: "Watch later", icon: Clock, path: "/watch-later" },
  { label: "Liked videos", icon: ThumbsUp, path: "/liked-videos" },
];

const exploreLinks = [
  { label: "Trending", icon: Flame, path: "/trending" },
  { label: "Music", icon: Music2, path: "/music" },
  { label: "Gaming", icon: Gamepad2, path: "/gaming" },
  { label: "Sports", icon: Trophy, path: "/sports" },
  { label: "Shopping", icon: ShoppingBag, path: "/shopping" },
];

function SidebarSection({
  title,
  titlePath,
  items,
  onNavigate,
  watchLaterCount = 0,
}) {
  return (
    <div className="sidebar-section">
      {title && (
        <button
          className="sidebar-section-title"
          type="button"
          onClick={() => titlePath && onNavigate(titlePath)}
        >
          {title}
          <ChevronRight size={18} />
        </button>
      )}

      {items.map(({ label, icon: Icon, path }) => (
        <button
          className="sidebar-link"
          key={label}
          type="button"
          onClick={() => path && onNavigate(path)}
          title={label}
        >
          <Icon size={22} strokeWidth={1.8} />
          <span>{label}</span>

          {label === "Watch later" && watchLaterCount > 0 && (
            <span className="sidebar-count">
              {watchLaterCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function Sidebar({ isOpen = true }) {
  const navigate = useNavigate();
  const { watchLater } = useWatchLater();

  function handleNavigate(path) {
    navigate(path);
  }

  return (
    <aside
      className={`sidebar ${
        isOpen ? "sidebar-expanded" : "sidebar-mini"
      }`}
    >
      {isOpen ? (
        <>
          <SidebarSection
            items={mainLinks}
            onNavigate={handleNavigate}
          />

          <SidebarSection
            title="You"
            titlePath="/you"
            items={personalLinks}
            onNavigate={handleNavigate}
            watchLaterCount={watchLater.length}
          />

          <SidebarSection
            title="Explore"
            items={exploreLinks}
            onNavigate={handleNavigate}
          />

          <div className="sidebar-section sidebar-bottom">
            <SidebarSection
              onNavigate={handleNavigate}
              items={[
                { label: "Settings", icon: Settings, path: "/settings" },
                { label: "Report history", icon: Flag, path: "/report-history" },
                { label: "Help", icon: CircleHelp, path: "/help" },
                {
                  label: "Send feedback",
                  icon: MessageSquareWarning,
                  path: "/feedback",
                },
              ]}
            />
          </div>

          <footer className="sidebar-footer">
            <div>About Press Copyright</div>
            <div>Contact us Creators</div>
            <div>Advertise Developers</div>
            <div>Terms Privacy Policy &amp; Safety</div>
            <p>© 2026 YouTube UI Project</p>
          </footer>
        </>
      ) : (
        <div className="sidebar-mini-links">
          <SidebarSection
            items={mainLinks}
            onNavigate={handleNavigate}
          />

          <button
            className="sidebar-mini-link"
            type="button"
            data-tooltip="You"
            onClick={() => handleNavigate("/you")}
          >
            <UserRound size={22} strokeWidth={1.8} />
            <span>You</span>
          </button>
        </div>
      )}
    </aside>
  );
}
