
import { useState } from "react";
import { UserRound, History, ListVideo, Clock, ThumbsUp, Clapperboard } from "lucide-react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const youOptions = [
  { label: "Your channel", icon: UserRound },
  { label: "History", icon: History, path: "/history" },
  { label: "Playlists", icon: ListVideo },
  { label: "Your videos", icon: Clapperboard },
  { label: "Watch later", icon: Clock, path: "/watch-later" },
  { label: "Liked videos", icon: ThumbsUp },
];

export default function You() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="app-shell">
      <Navbar
        onMenuClick={() => setSidebarOpen((previous) => !previous)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="app-body">
        <Sidebar isOpen={sidebarOpen} />

        <main
          className={`main-content ${
            sidebarOpen ? "sidebar-expanded" : "sidebar-mini"
          }`}
        >
          <section className="you-page">
            <h1>You</h1>
            <p>Manage your YouTube activity</p>

            <div className="you-options">
              {youOptions.map(({ label, icon: Icon, path }) => (
                <button
                  key={label}
                  type="button"
                  className="you-option"
                  onClick={() => path && (window.location.href = path)}
                >
                  <Icon size={24} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
