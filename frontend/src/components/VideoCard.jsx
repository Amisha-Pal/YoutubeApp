
import { useState } from "react";
import { Link } from "react-router-dom";
import { ClockPlus, Check, MoreVertical, Clock } from "lucide-react";
import { useWatchLater } from "../context/WatchLaterContext";

export default function VideoCard({ video }) {
  const {
    addToWatchLater,
    removeFromWatchLater,
    isInWatchLater,
  } = useWatchLater();

  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState("");

  const saved = isInWatchLater(video.id);

  function handleWatchLater() {
    if (saved) {
      removeFromWatchLater(video.id);
      setMessage("Removed from Watch Later");
    } else {
      addToWatchLater(video);
      setMessage("Added to Watch Later");
    }

    setMenuOpen(false);

    setTimeout(() => {
      setMessage("");
    }, 2000);
  }

  return (
    <article className="video-card">
      <Link
        className="video-thumbnail"
        to={`/watch/${video.id}`}
        aria-label={`Watch ${video.title}`}
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          loading="lazy"
        />

        {video.duration && (
          <span className="video-duration">{video.duration}</span>
        )}
      </Link>

      <div className="video-details">
        <img
          className="channel-avatar"
          src={video.avatar}
          alt={`${video.channel} profile`}
          loading="lazy"
        />

        <div className="video-info">
          <h3 className="video-title">
            <Link to={`/watch/${video.id}`}>{video.title}</Link>
          </h3>

          <p className="channel-name">
            {video.ownerId ? (
              <Link to={`/channel/${video.ownerId}`}>{video.channel}</Link>
            ) : (
              video.channel
            )}
          </p>

          <p className="video-meta">
            {video.views} views <span>·</span> {video.uploaded}
          </p>
        </div>

        <div className="video-card-actions">
          <button
            type="button"
            className={`video-more-button ${saved ? "video-saved" : ""}`}
            aria-label={`More options for ${video.title}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((previous) => !previous)}
          >
            <MoreVertical size={21} />
          </button>

          {menuOpen && (
            <div className="video-options-menu">
              <button
                type="button"
                className="video-options-item"
                onClick={handleWatchLater}
              >
                {saved ? (
                  <Check size={19} />
                ) : (
                  <ClockPlus size={19} />
                )}

                <span>
                  {saved
                    ? "Remove from Watch Later"
                    : "Save to Watch Later"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className="watch-later-toast" role="status">
          <Clock size={17} />
          <span>{message}</span>
        </div>
      )}
    </article>
  );
}

