
import { useState } from "react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function Subscriptions() {
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
          <section className="subscriptions-page">
            <h1>Subscriptions</h1>
            <p>Videos from your subscribed channels will appear here.</p>

            <div className="empty-results">
              <h2>No subscriptions yet</h2>
              <p>Subscribe to channels to see their latest videos here.</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
