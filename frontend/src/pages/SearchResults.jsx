import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import VideoCard from "../components/VideoCard";
import CategoryBar from "../components/CategoryBar";
import axiosClient from "../api/axiosClient";
import ChannelSearchCard from "../components/ChannelSearchCard";

const FALLBACK_THUMBNAIL =
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=640&h=360&fit=crop";

function formatViews(count) {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
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
    const days = Math.floor(
        (new Date() - uploadedDate) / (1000 * 60 * 60 * 24)
    );

    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;

    return `${Math.floor(days / 365)} years ago`;
}

function formatVideo(video) {
    return {
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
    };
}

export default function SearchResults() {
    const [searchParams] = useSearchParams();
    const query = searchParams.get("q") || "";

    const [searchInput, setSearchInput] = useState(query);
    const [previousQuery, setPreviousQuery] = useState(query);

    // Keep the local search box in sync when the URL query changes.
    if (query !== previousQuery) {
        setPreviousQuery(query);
        setSearchInput(query);
    }

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState("All");
    const [sortBy, setSortBy] = useState("latest");

    const [uploadDate, setUploadDate] = useState("");
    const [durationFilter, setDurationFilter] = useState("");

    const [searchType, setSearchType] = useState("videos");
    const [channels, setChannels] = useState([]);

    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        if (searchType !== "videos") return;
        let isCancelled = false;

        async function fetchVideos() {
            try {
                setLoading(true);
                setError("");

                const response = await axiosClient.get("videos/", {
                    params: {
                        search: query.trim(),
                        ...(activeCategory !== "All" ? { category: activeCategory } : {}),
                        ...(uploadDate ? { upload_date: uploadDate } : {}),
                        ...(durationFilter ? { duration: durationFilter } : {}),
                        sort: sortBy,
                        page: 1,
                    }
                });

                if (isCancelled) return;

                setVideos(response.data.results.map(formatVideo));
                setPage(1);
                setHasMore(Boolean(response.data.next));
            } catch (err) {
                if (!isCancelled) {
                    console.error("Search failed:", err);
                    setError("Search results load nahi ho paaye. Please try again.");
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
    }, [query, activeCategory, sortBy, searchType, uploadDate, durationFilter]);

    useEffect(() => {
        if (searchType !== "channels") return;

        let isCancelled = false;

        async function fetchChannels() {
            try {
                setLoading(true);
                setError("");

                const response = await axiosClient.get(
                    "videos/channels/search/",
                    {
                        params: {
                            search: query.trim(),
                        },
                    }
                );

                if (isCancelled) return;

                setChannels(response.data.results || response.data);
            } catch (err) {
                if (!isCancelled) {
                    console.error("Channel search failed:", err);
                    setError("Channels load nahi ho paaye. Please try again.");
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        }

        fetchChannels();

        return () => {
            isCancelled = true;
        };
    }, [searchType, query]);

    async function loadMoreVideos() {
        try {
            setLoadingMore(true);

            const nextPage = page + 1;

            const response = await axiosClient.get("videos/", {
                params: {
                    search: query.trim(),
                    ...(activeCategory !== "All"
                        ? { category: activeCategory }
                        : {}),
                    ...(uploadDate ? { upload_date: uploadDate } : {}),
                    ...(durationFilter ? { duration: durationFilter } : {}),
                    sort: sortBy,
                    page: nextPage,
                },
            });

            setVideos((previous) => [
                ...previous,
                ...response.data.results.map(formatVideo),
            ]);

            setPage(nextPage);
            setHasMore(Boolean(response.data.next));
        } catch (err) {
            console.error("Load more search results failed:", err);
        } finally {
            setLoadingMore(false);
        }
    }

    return (
        <div className="app-shell">
            <Navbar
                onMenuClick={() => setSidebarOpen((previous) => !previous)}
                searchQuery={searchInput}
                onSearchChange={setSearchInput}
            />

            <div className="app-body">
                <Sidebar isOpen={sidebarOpen} />

                <main
                    className={`main-content ${sidebarOpen ? "sidebar-expanded" : "sidebar-mini"
                        }`}
                >
                    {searchType === "videos" && (
                        <CategoryBar
                            activeCategory={activeCategory}
                            onCategoryChange={setActiveCategory}
                        />
                    )}

                    <section className="video-grid-section">
                        <div className="search-results-heading">
                            <h2>Search results for: "{query}"</h2>
                        </div>

                        <div className="search-type-tabs">
                            <button
                                className={searchType === "videos" ? "active" : ""}
                                onClick={() => setSearchType("videos")}
                            >
                                Videos
                            </button>

                            <button
                                className={searchType === "channels" ? "active" : ""}
                                onClick={() => setSearchType("channels")}
                            >
                                Channels
                            </button>
                        </div>
                        {searchType === "videos" && (
                            <div className="sort-container">
                                <label htmlFor="search-sort">Sort by:</label>

                                <select
                                    id="search-sort"
                                    value={sortBy}
                                    onChange={(event) => setSortBy(event.target.value)}
                                >
                                    <option value="latest">Latest</option>
                                    <option value="popular">Most Viewed</option>
                                    <option value="oldest">Oldest</option>
                                </select>
                                <div className="filter-container">
                                    <label htmlFor="upload-date">Upload Date:</label>
                                    <select
                                        id="upload-date"
                                        value={uploadDate}
                                        onChange={(event) => setUploadDate(event.target.value)}
                                    >
                                        <option value="">Any time</option>
                                        <option value="today">Today</option>
                                        <option value="week">This week</option>
                                        <option value="month">This month</option>
                                        <option value="year">This year</option>
                                    </select>
                                </div>

                                <div className="filter-container">
                                    <label htmlFor="duration-filter">Duration:</label>
                                    <select
                                        id="duration-filter"
                                        value={durationFilter}
                                        onChange={(event) => setDurationFilter(event.target.value)}
                                    >
                                        <option value="">Any duration</option>
                                        <option value="under_4">Under 4 minutes</option>
                                        <option value="4_to_20">4–20 minutes</option>
                                        <option value="over_20">Over 20 minutes</option>
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    className="clear-filters-btn"
                                    onClick={() => {
                                        setActiveCategory("All");
                                        setSortBy("latest");
                                        setUploadDate("");
                                        setDurationFilter("");
                                    }}
                                >
                                    Clear All Filters
                                </button>
                            </div>
                        )}

                        <div className="video-grid">
                            {loading ? (
                                <div className="empty-results">
                                    <h2>Searching...</h2>
                                </div>
                            ) : error ? (
                                <div className="empty-results">
                                    <h2>Something went wrong</h2>
                                    <p>{error}</p>
                                </div>
                            ) : searchType === "channels" ? (
                                channels.length > 0 ? (
                                    channels.map((channel) => (
                                        <ChannelSearchCard
                                            key={channel.id}
                                            channel={channel}
                                        />
                                    ))
                                ) : (
                                    <div className="empty-results">
                                        <h2>No channels found</h2>
                                        <p>Try another channel name.</p>
                                    </div>
                                )
                            ) : videos.length > 0 ? (
                                videos.map((video) => (
                                    <VideoCard key={video.id} video={video} />
                                ))
                            ) : (
                                <div className="empty-results">
                                    <h2>No videos found</h2>
                                    <p>Try another search or select a different category.</p>
                                </div>
                            )}
                        </div>

                        {searchType === "videos" && hasMore && !loading && !error && (
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