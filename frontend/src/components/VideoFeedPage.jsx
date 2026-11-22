import { useEffect, useState } from "react";
import PageLayout from "./PageLayout";
import VideoCard from "./VideoCard";
import AuthModal from "./AuthModal";
import axiosClient from "../api/axiosClient";
import { formatVideo } from "../utils/format";
import { isLoggedIn } from "../utils/auth";

export default function VideoFeedPage({
  title,
  icon: Icon,
  endpoint = "videos/",
  params,
  requiresAuth = false,
  emptyTitle = "No videos yet",
  emptyMessage = "Check back later for new videos.",
  children,
}) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextPage, setNextPage] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const signedOut = requiresAuth && !isLoggedIn();
  const paramsKey = JSON.stringify(params || {});

  useEffect(() => {
    if (signedOut) return undefined;
    let cancelled = false;

    axiosClient
      .get(endpoint, { params: { ...JSON.parse(paramsKey), page: 1 } })
      .then((response) => {
        if (cancelled) return;
        const data = response.data;
        setVideos((data.results || data).map(formatVideo));
        setNextPage(data.next ? 2 : null);
        setError("");
      })
      .catch(() => !cancelled && setError("Videos could not be loaded. Please try again."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [endpoint, paramsKey, signedOut]);

  async function loadMore() {
    if (!nextPage) return;
    try {
      setLoadingMore(true);
      const response = await axiosClient.get(endpoint, {
        params: { ...JSON.parse(paramsKey), page: nextPage },
      });
      setVideos((previous) => [
        ...previous,
        ...response.data.results.map(formatVideo),
      ]);
      setNextPage(response.data.next ? nextPage + 1 : null);
    } catch {
      setError("More videos could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <PageLayout>
      <section className="feed-page">
        <header className="feed-header">
          {Icon && <Icon size={28} />}
          <h1>{title}</h1>
        </header>

        {signedOut ? (
          <div className="empty-results">
            <h2>Sign in to see {title.toLowerCase()}</h2>
            <button type="button" className="load-more-btn" onClick={() => setAuthOpen(true)}>
              Sign in
            </button>
          </div>
        ) : (
          <>
            {children}
            <div className="video-grid">
              {loading ? (
                <div className="empty-results"><h2>Loading videos...</h2></div>
              ) : error ? (
                <div className="empty-results"><h2>Something went wrong</h2><p>{error}</p></div>
              ) : videos.length === 0 ? (
                <div className="empty-results"><h2>{emptyTitle}</h2><p>{emptyMessage}</p></div>
              ) : (
                videos.map((video) => <VideoCard key={video.id} video={video} />)
              )}
            </div>
            {nextPage && !loading && (
              <div className="load-more-container">
                <button type="button" className="load-more-btn" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </PageLayout>
  );
}
