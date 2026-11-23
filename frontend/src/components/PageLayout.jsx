import { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function PageLayout({ children, defaultSidebarOpen = true }) {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => defaultSidebarOpen && window.innerWidth > 1000
  );
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
          {children}
        </main>
      </div>
    </div>
  );
}
