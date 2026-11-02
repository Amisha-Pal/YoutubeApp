
import { Link } from "react-router-dom";
import { Clock, Trash2, Play, ListVideo } from "lucide-react";

import { useWatchLater } from "../context/WatchLaterContext";

export default function WatchLater() {
  const { watchLater, removeFromWatchLater } = useWatchLater();

  return (
    <main className="watch-later-page">
      <section className="watch-later-heading">
        <div className="watch-later-heading-icon">
          <Clock size={30} />
        </div>

        <div>
          <h1>Watch Later</h1>
          <p>{watchLater.length} videos</p>
        </div>
      </section>

      {watchLater.length === 0 ? (
        <section className="watch-later-empty">
          <ListVideo size={64} strokeWidth={1.3} />

          <h2>Your Watch Later list is empty</h2>

          <p>
            Save videos you want to watch later, and they will appear here.
          </p>

          <Link to="/" className="watch-later-home-button">
            Explore videos
          </Link>
        </section>
      ) : (
        <section className="watch-later-list">
          {watchLater.map((video) => (
            <article className="watch-later-video" key={video.id}>
              <Link
                to={`/watch/${video.id}`}
                className="watch-later-thumbnail"
                aria-label={`Watch ${video.title}`}
              >
                <img src={video.thumbnail} alt={video.title} loading="lazy" />

                <span className="video-duration">{video.duration}</span>

                <span className="watch-later-play">
                  <Play size={24} fill="white" />
                </span>
              </Link>

              <div className="watch-later-video-info">
                <Link
                  to={`/watch/${video.id}`}
                  className="watch-later-video-title"
                >
                  {video.title}
                </Link>

                <p className="watch-later-channel">{video.channel}</p>

                <p className="watch-later-meta">
                  {video.views} views <span>·</span> {video.uploaded}
                </p>

                {video.description && (
                  <p className="watch-later-description">
                    {video.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                className="watch-later-remove"
                title="Remove from Watch Later"
                aria-label={`Remove ${video.title} from Watch Later`}
                onClick={() => removeFromWatchLater(video.id)}
              >
                <Trash2 size={20} />
              </button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

