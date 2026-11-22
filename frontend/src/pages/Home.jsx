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

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
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
  const [sortBy, setSortBy] = useState("latest");

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function fetchVideos() {
      try {
        setLoading(true);
        setError("");

        const query = searchQuery.trim();

        const response = await axiosClient.get("videos/", {
          params: {
            ...(query ? { search: query } : {}),
            ...(activeCategory !== "All"
              ? { category: activeCategory }
              : {}),
            sort: sortBy,
            page: 1,
          },
        });
        console.log("HOME VIDEOS API:", response.data);
        console.log("VIDEO TITLES:", response.data.results.map(v => v.title));

        if (isCancelled) return;

        const formattedVideos = response.data.results.map((video) => ({
          id: video.id,
          title: video.title,
          channel: video.owner_username,
          views: formatViews(video.views_count),
          uploaded: formatUploadedDate(video.created_at),
          duration: formatDuration(video.duration),
          category: video.category,
          thumbnail: video.thumbnail || FALLBACK_THUMBNAIL,
          videoUrl: video.video_file,
          avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
            video.owner_username
          )}`,
          description: video.description,
        }));

        setVideos(formattedVideos);
        setPage(1);
        setHasMore(Boolean(response.data.next));
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to fetch videos:", err);
          setError("Videos load nahi ho paayi. Please try again.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(fetchVideos, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, activeCategory, sortBy]);

  async function loadMoreVideos() {
    try {
      setLoadingMore(true);

      const query = searchQuery.trim();
      const nextPage = page + 1;

      const response = await axiosClient.get("videos/", {
        params: {
          ...(query ? { search: query } : {}),
          ...(activeCategory !== "All"
            ? { category: activeCategory }
            : {}),
          sort: sortBy,
          page: nextPage,
        },
      });

      const formattedVideos = response.data.results.map((video) => ({
        id: video.id,
        title: video.title,
        channel: video.owner_username,
        views: formatViews(video.views_count),
        uploaded: formatUploadedDate(video.created_at),
        duration: formatDuration(video.duration),
        category: video.category,
        thumbnail: video.thumbnail || FALLBACK_THUMBNAIL,
        videoUrl: video.video_file,
        avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
          video.owner_username
        )}`,
        description: video.description,
      }));

      setVideos((previousVideos) => [
        ...previousVideos,
        ...formattedVideos,
      ]);

      setPage(nextPage);
      setHasMore(Boolean(response.data.next));
    } catch (err) {
      console.error("Failed to load more videos:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      return (
        activeCategory === "All" ||
        video.category === activeCategory
      );
    });
  }, [videos, activeCategory]);

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

          <div className="sort-container">
            <label htmlFor="video-sort">Sort by:</label>

            <select
              id="video-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="latest">Latest</option>
              <option value="popular">Most Popular</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>

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
            {hasMore && !loading && !error && (
              <div className="load-more-container">
                <button
                  className="load-more-btn"
                  onClick={loadMoreVideos}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
