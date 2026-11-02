import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import CategoryBar from "../components/CategoryBar";
import VideoCard from "../components/VideoCard";
import axiosClient from "../api/axiosClient";

const FALLBACK_THUMBNAIL =
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=640&h=360&fit=crop";

function formatViews(count) {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }

  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }

  return String(count);
}

function formatUploadedDate(date) {
  const uploadedDate = new Date(date);
  const now = new Date();
  const difference = now - uploadedDate;

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;

  return `${Math.floor(days / 365)} years ago`;
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchVideos() {
      try {
        setLoading(true);
        setError("");

        const response = await axiosClient.get("videos/");

        const formattedVideos = response.data.map((video) => ({
          id: video.id,
          title: video.title,
          channel: video.owner_username,
          views: formatViews(video.views_count),
          uploaded: formatUploadedDate(video.created_at),
          duration: "",
          category: video.category,
          thumbnail: video.thumbnail || FALLBACK_THUMBNAIL,
          videoUrl: video.video_file,
          avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
            video.owner_username
          )}`,
          description: video.description,
        }));

        setVideos(formattedVideos);
      } catch (err) {
        console.error("Failed to fetch videos:", err);
        setError("Videos load nahi ho paayi. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchVideos();
  }, []);

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const matchesCategory =
        activeCategory === "All" ||
        video.category === activeCategory;

      const query = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !query ||
        video.title.toLowerCase().includes(query) ||
        video.channel.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [videos, activeCategory, searchQuery]);

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
          className={`main-content ${sidebarOpen ? "sidebar-expanded" : "sidebar-mini"
            }`}
        >
          <CategoryBar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          <section className="video-grid-section">
            <div className="video-grid">
              {loading ? (
                <div className="empty-results">
                  <h2>Loading videos...</h2>
                </div>
              ) : error ? (
                <div className="empty-results">
                  <h2>Something went wrong</h2>
                  <p>{error}</p>
                </div>
              ) : filteredVideos.length > 0 ? (
                filteredVideos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))
              ) : (
                <div className="empty-results">
                  <h2>No videos found</h2>
                  <p>
                    Try another search or select a different category.
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
