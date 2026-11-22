import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Bell, BellRing, Pencil } from "lucide-react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import VideoCard from "../components/VideoCard";
import axiosClient from "../api/axiosClient";
import { getCurrentUserId } from "../utils/auth";
import ChannelCustomization from "../components/ChannelCustomization";

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
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatUploadedDate(date) {
    const days = Math.floor(
        (new Date() - new Date(date)) / (1000 * 60 * 60 * 24)
    );

    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;

    return `${Math.floor(days / 365)} years ago`;
}

export default function Channel() {
    const { channelId } = useParams();

    const [showCustomization, setShowCustomization] = useState(false);
    const [customizationRefresh, setCustomizationRefresh] = useState(0);

    const currentUserId = getCurrentUserId();
    const isOwnChannel = String(currentUserId) === String(channelId);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [channel, setChannel] = useState(null);
    const [videos, setVideos] = useState([]);
    const [activeTab, setActiveTab] = useState("Home");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [subscriptionLoading, setSubscriptionLoading] = useState(false);
    const [channelDetails, setChannelDetails] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchChannel() {
            try {
                setLoading(true);
                setError("");

                const [profileResponse, videosResponse] = await Promise.all([
                    axiosClient.get(`videos/channels/${channelId}/`),
                    axiosClient.get(`videos/channels/${channelId}/videos/`),
                ]);

                if (cancelled) return;

                setChannel(profileResponse.data);
                setChannelDetails(
                    profileResponse.data.channel_customization || null
                );

                const results = videosResponse.data.results || videosResponse.data;

                const formattedVideos = results.map((video) => ({
                    id: video.id,
                    title: video.title,
                    channel: video.owner_username,
                    views: formatViews(video.views_count),
                    uploaded: formatUploadedDate(video.created_at),
                    duration: formatDuration(video.duration),
                    category: video.category,
                    thumbnail: video.thumbnail || FALLBACK_THUMBNAIL,
                    videoUrl: video.video_file,
                    avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(video.owner_username)}`,
                    description: video.description,
                }));

                setVideos(formattedVideos);
            } catch (err) {
                console.error("Channel loading failed:", err);
                if (!cancelled) {
                    setError("Channel load nahi ho paya. Please try again.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchChannel();

        return () => {
            cancelled = true;
        };
    }, [channelId, customizationRefresh]);

    async function handleSubscribe() {
        if (!localStorage.getItem("accessToken")) {
            setError("Subscribe karne ke liye pehle login karein.");
            return;
        }

        try {
            setSubscriptionLoading(true);

            const endpoint = `videos/channels/${channelId}/subscribe/`;
            const response = channel?.is_subscribed
                ? await axiosClient.delete(endpoint)
                : await axiosClient.post(endpoint);

            setChannel((previous) => ({
                ...previous,
                is_subscribed: response.data.is_subscribed,
                subscribers_count: response.data.subscribers_count,
            }));
        } catch (err) {
            console.error("Subscription failed:", err);
            setError(
                err.response?.data?.detail || "Subscription update nahi ho paya."
            );
        } finally {
            setSubscriptionLoading(false);
        }
    }

    const avatar = channelDetails?.profile_picture || (
        channel
            ? `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(channel.username)}`
            : ""
    );

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
                    {loading ? (
                        <div className="empty-results">
                            <h2>Loading channel...</h2>
                        </div>
                    ) : error && !channel ? (
                        <div className="empty-results">
                            <h2>Channel unavailable</h2>
                            <p>{error}</p>
                        </div>
                    ) : channel ? (
                        <>
                            {showCustomization && (
                                <ChannelCustomization
                                    onClose={() => setShowCustomization(false)}
                                    onSaved={() => {
                                        setCustomizationRefresh((previous) => previous + 1);
                                    }}
                                />
                            )}


                            <section className="channel-page">
                                {channelDetails?.banner && (
                                    <img
                                        className="channel-banner"
                                        src={channelDetails.banner}
                                        alt="Channel banner"
                                    />
                                )}
                                <div className="channel-header">
                                    <img
                                        className="channel-page-avatar"
                                        src={avatar}
                                        alt={`${channel.username} avatar`}
                                    />

                                    <div className="channel-header-info">
                                        <h1>{channel.username}</h1>

                                        {channelDetails?.description && (
                                            <p className="channel-description">
                                                {channelDetails.description}
                                            </p>
                                        )}

                                        <p>
                                            @{channel.username} ·{" "}
                                            {channel.subscribers_count.toLocaleString("en-IN")}{" "}
                                            subscribers · {channel.videos_count} videos
                                        </p>

                                        <button
                                            type="button"
                                            className={`subscribe-button ${channel.is_subscribed ? "subscribed" : ""
                                                }`}
                                            onClick={handleSubscribe}
                                            disabled={subscriptionLoading}
                                        >
                                            {channel.is_subscribed ? (
                                                <BellRing size={18} />
                                            ) : (
                                                <Bell size={18} />
                                            )}

                                            {subscriptionLoading
                                                ? "Please wait..."
                                                : channel.is_subscribed
                                                    ? "Subscribed"
                                                    : "Subscribe"}
                                        </button>

                                        {isOwnChannel && (
                                            <button
                                                type="button"
                                                className="customize-channel-button"
                                                onClick={() => setShowCustomization(true)}
                                            >
                                                <Pencil size={18} />
                                                Customize Channel
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {error && <p className="channel-error">{error}</p>}

                                <div className="channel-tabs">
                                    {["Home", "Videos"].map((tab) => (
                                        <button
                                            key={tab}
                                            type="button"
                                            className={`channel-tab ${activeTab === tab ? "active" : ""}`}
                                            onClick={() => setActiveTab(tab)}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                <div className="channel-videos-section">
                                    <h2>
                                        {activeTab === "Home" ? "Latest videos" : "All videos"}
                                    </h2>

                                    {videos.length > 0 ? (
                                        <div className="video-grid">
                                            {(activeTab === "Home"
                                                ? videos.slice(0, 4)
                                                : videos
                                            ).map((video) => (
                                                <VideoCard key={video.id} video={video} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-results">
                                            <h2>No videos uploaded yet</h2>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </>
                    ) : null}
                </main>
            </div>
        </div>
    );
}