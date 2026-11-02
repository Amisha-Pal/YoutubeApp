
import { Link } from "react-router-dom";
import { History as HistoryIcon, Trash2, Play } from "lucide-react";

import { useHistory } from "../context/HistoryContext";

export default function History() {
  const {
    history,
    removeFromHistory,
    clearHistory,
  } = useHistory();

  function handleClearHistory() {
    if (history.length === 0) return;

    const confirmed = window.confirm(
      "Kya tum poori watch history delete karna chahti ho?"
    );

    if (confirmed) {
      clearHistory();
    }
  }

  return (
    <main className="history-page">
      <div className="history-page-header">
        <div className="history-heading">
          <HistoryIcon size={30} />
          <div>
            <h1>Watch History</h1>
            <p>{history.length} videos watched</p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            className="clear-history-button"
            onClick={handleClearHistory}
          >
            <Trash2 size={18} />
            Clear watch history
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <section className="history-empty">
          <HistoryIcon size={64} strokeWidth={1.3} />
          <h2>Your watch history is empty</h2>
          <p>Videos you watch will appear here.</p>

          <Link to="/" className="history-home-button">
            Explore videos
          </Link>
        </section>
      ) : (
        <section className="history-video-list">
          {history.map((video) => (
            <article className="history-video" key={video.id}>
              <Link
                to={`/watch/${video.id}`}
                className="history-thumbnail"
                aria-label={`Watch ${video.title}`}
              >
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  loading="lazy"
                />

                <span className="video-duration">
                  {video.duration}
                </span>

                <span className="history-play-overlay">
                  <Play size={24} fill="white" />
                </span>
              </Link>

              <div className="history-video-info">
                <Link
                  to={`/watch/${video.id}`}
                  className="history-video-title"
                >
                  {video.title}
                </Link>

                <p>{video.channel}</p>

                <p>
                  {video.views} views
                  {video.watchedAt && (
                    <>
                      {" · "}
                      Watched{" "}
                      {new Date(video.watchedAt).toLocaleString()}
                    </>
                  )}
                </p>
              </div>

              <button
                type="button"
                className="history-remove-button"
                aria-label={`Remove ${video.title} from history`}
                title="Remove from watch history"
                onClick={() => removeFromHistory(video.id)}
              >
                <Trash2 size={19} />
              </button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

