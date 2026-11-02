import { useWatchLater } from "../context/WatchLaterContext";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  Download,
  MoreHorizontal,
  CircleUserRound,
  Check,
  Copy,
  Play,
  Clock,
} from "lucide-react";

import Navbar from "../components/Navbar";
import { videos } from "../features/videos/videoData";
import { useHistory } from "../context/HistoryContext";

export default function Watch() {
  const { id } = useParams();
  const { addToHistory } = useHistory();

  const [liked, setLiked] = useState(
    () => localStorage.getItem(`youtube-liked-${id}`) === "true"
  );

  const [disliked, setDisliked] = useState(
    () => localStorage.getItem(`youtube-disliked-${id}`) === "true"
  );

  const [likeCount, setLikeCount] = useState(
    () => Number(localStorage.getItem(`youtube-like-count-${id}`)) || 0
  );

  const [subscribed, setSubscribed] = useState(
    () => localStorage.getItem(`youtube-subscribed-${id}`) === "true"
  );

  const { addToWatchLater, removeFromWatchLater, isInWatchLater, } = useWatchLater();

  const [shareMessage, setShareMessage] = useState("");
  const [comment, setComment] = useState("");
  const [replyInputs, setReplyInputs] = useState({});
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  const [comments, setComments] = useState(() => {
    try {
      const savedComments = localStorage.getItem(`youtube-comments-${id}`);
      return savedComments ? JSON.parse(savedComments) : [];
    } catch {
      return [];
    }
  });

  const video = videos.find(
    (item) => String(item.id) === String(id)
  );

  // Video ko history mein add karna
  useEffect(() => {
    if (video) {
      addToHistory(video);
    }
  }, [video, addToHistory]);

  // Comments, replies aur unke likes save karna
  useEffect(() => {
    localStorage.setItem(
      `youtube-comments-${id}`,
      JSON.stringify(comments)
    );
  }, [id, comments]);

  // Video actions save karna
  useEffect(() => {
    localStorage.setItem(`youtube-liked-${id}`, String(liked));
    localStorage.setItem(`youtube-disliked-${id}`, String(disliked));
    localStorage.setItem(`youtube-like-count-${id}`, String(likeCount));
    localStorage.setItem(`youtube-subscribed-${id}`, String(subscribed));
  }, [id, liked, disliked, likeCount, subscribed]);

  // Video nahi mila
  if (!video) {
    return (
      <div className="app-shell">
        <Navbar />

        <main className="watch-not-found">
          <h2>Video not found</h2>
          <p>Ye video abhi available nahi hai.</p>
          <Link to="/">Go to Home</Link>
        </main>
      </div>
    );
  }

  function handleWatchLater() {
    if (isInWatchLater(video.id)) {
      removeFromWatchLater(video.id);
      setShareMessage("Video Watch Later se remove ho gayi.");
    } else {
      addToWatchLater(video);
      setShareMessage("Video Watch Later mein save ho gayi.");
    }

    window.setTimeout(() => setShareMessage(""), 3000);
  }

  // Video Like / Unlike
  function handleLike() {
    if (liked) {
      setLiked(false);
      setLikeCount((count) => Math.max(0, count - 1));
    } else {
      setLiked(true);
      setLikeCount((count) => count + 1);

      if (disliked) {
        setDisliked(false);
      }
    }
  }

  // Video Dislike
  function handleDislike() {
    if (disliked) {
      setDisliked(false);
    } else {
      setDisliked(true);

      if (liked) {
        setLiked(false);
        setLikeCount((count) => Math.max(0, count - 1));
      }
    }
  }

  // Video share karna
  async function handleShare() {
    const videoUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title,
          text: `Watch ${video.title}`,
          url: videoUrl,
        });
      } else {
        await navigator.clipboard.writeText(videoUrl);
        setShareMessage("Video link copied!");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setShareMessage(
          "Link copy nahi hua. Browser address bar se URL copy karo."
        );
      }
    }

    window.setTimeout(() => setShareMessage(""), 3000);
  }

  // Video download
  function handleDownload() {
    if (!video.videoUrl) {
      setShareMessage("Is video ka download URL available nahi hai.");
      window.setTimeout(() => setShareMessage(""), 3000);
      return;
    }

    const link = document.createElement("a");
    link.href = video.videoUrl;
    link.download = `${video.title}.mp4`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => setShareMessage(""), 3000);
  }

  // Naya comment add karna
  function handleCommentSubmit(event) {
    event.preventDefault();

    const text = comment.trim();
    if (!text) return;

    setComments((previous) => [
      {
        id: Date.now(),
        text,
        liked: false,
        likes: 0,
        replies: [],
      },
      ...previous,
    ]);

    setComment("");
  }

  // Comment Like / Unlike
  function handleCommentLike(commentId) {
    setComments((previous) =>
      previous.map((item) => {
        if (item.id !== commentId) return item;

        const wasLiked = Boolean(item.liked);

        return {
          ...item,
          liked: !wasLiked,
          likes: Math.max(
            0,
            (item.likes || 0) + (wasLiked ? -1 : 1)
          ),
        };
      })
    );
  }

  // Reply Like / Unlike
  function handleReplyLike(commentId, replyId) {
    setComments((previous) =>
      previous.map((item) => {
        if (item.id !== commentId) return item;

        return {
          ...item,
          replies: (item.replies || []).map((reply) => {
            if (reply.id !== replyId) return reply;

            const wasLiked = Boolean(reply.liked);

            return {
              ...reply,
              liked: !wasLiked,
              likes: Math.max(
                0,
                (reply.likes || 0) + (wasLiked ? -1 : 1)
              ),
            };
          }),
        };
      })
    );
  }

  // Reply input update karna
  function handleReplyInputChange(commentId, value) {
    setReplyInputs((previous) => ({
      ...previous,
      [commentId]: value,
    }));
  }

  // Comment ka reply add karna
  function handleReplySubmit(event, commentId) {
    event.preventDefault();

    const text = (replyInputs[commentId] || "").trim();
    if (!text) return;

    setComments((previous) =>
      previous.map((item) =>
        item.id === commentId
          ? {
            ...item,
            replies: [
              ...(item.replies || []),
              {
                id: `${Date.now()}-${Math.random()}`,
                text,
                liked: false,
                likes: 0,
              },
            ],
          }
          : item
      )
    );

    setReplyInputs((previous) => ({
      ...previous,
      [commentId]: "",
    }));
  }

  // Comment delete karna
  function handleDeleteComment(commentId) {
    setComments((previous) =>
      previous.filter((item) => item.id !== commentId)
    );
  }

  return (
    <div className="app-shell">
      <Navbar />

      <main className="watch-layout">
        <section className="watch-main">
          {/* Video player */}
          <div className="player-container">
            {video.videoUrl ? (
              <video
                key={video.id}
                controls
                playsInline
                poster={video.thumbnail}
                preload="metadata"
                onLoadStart={() => {
                  setVideoLoading(true);
                  setVideoError(false);
                }}
                onCanPlay={() => {
                  setVideoLoading(false);
                  setVideoError(false);
                }}
                onError={() => {
                  setVideoLoading(false);
                  setVideoError(true);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  aspectRatio: "16 / 9",
                  backgroundColor: "#000",
                  borderRadius: "12px",
                }}
              >
                <source src={video.videoUrl} type="video/mp4" />
                Your browser does not support video playback.
              </video>
            ) : (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  aspectRatio: "16 / 9",
                  backgroundColor: "#111",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.45,
                  }}
                />

                <div
                  style={{
                    position: "relative",
                    textAlign: "center",
                    color: "#fff",
                    padding: "20px",
                  }}
                >
                  <Play size={42} />
                  <h3>Video abhi available nahi hai</h3>
                  <p>
                    Is video ke liye abhi playback URL add nahi hua hai.
                  </p>
                </div>
              </div>
            )}
          </div>

          {videoLoading && video.videoUrl && !videoError && (
            <p role="status">Video load ho rahi hai...</p>
          )}

          {videoError && (
            <p role="alert">
              Video load nahi ho payi. Internet ya video URL check karo.
            </p>
          )}

          <h1 className="watch-title">{video.title}</h1>

          {/* Channel aur video actions */}
          <div className="watch-video-actions">
            <div className="watch-channel">
              <img src={video.avatar} alt={video.channel} />

              <div>
                <h3>{video.channel}</h3>
                <p>Sample channel</p>
              </div>

              <button
                className={`subscribe-button ${subscribed ? "subscribed" : ""
                  }`}
                type="button"
                onClick={() => setSubscribed((previous) => !previous)}
              >
                {subscribed ? (
                  <>
                    <Check size={16} />
                    Subscribed
                  </>
                ) : (
                  "Subscribe"
                )}
              </button>
            </div>

            <div className="action-buttons">
              <button
                type="button"
                className={liked ? "active-action" : ""}
                onClick={handleLike}
                aria-pressed={liked}
                title="Like"
              >
                <ThumbsUp size={19} />
                Like {likeCount > 0 && likeCount}
              </button>

              <button
                type="button"
                className={disliked ? "active-action" : ""}
                onClick={handleDislike}
                aria-pressed={disliked}
                title="Dislike"
              >
                <ThumbsDown size={19} />
                Dislike
              </button>

              <button type="button" onClick={handleShare}>
                <Share2 size={19} />
                Share
              </button>

              <button
                type="button"
                onClick={handleWatchLater}
                aria-pressed={isInWatchLater(video.id)}
              >
                <Clock size={19} />
                {isInWatchLater(video.id) ? "Saved" : "Watch Later"}
              </button>

              <button type="button" onClick={handleDownload}>
                <Download size={19} />
                Download
              </button>

              <button type="button" aria-label="More options">
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>

          {shareMessage && (
            <p className="share-message" role="status">
              <Copy size={16} />
              {shareMessage}
            </p>
          )}

          {/* Video description */}
          <div className="watch-description">
            <p>
              {video.views} views · {video.uploaded}
            </p>

            <p>
              Welcome to {video.channel}! Watch this video and explore
              more content on our YouTube-style application.
            </p>
          </div>

          {/* Comments section */}
          <section className="comments-section">
            <h2>Comments ({comments.length})</h2>

            <form className="add-comment" onSubmit={handleCommentSubmit}>
              <CircleUserRound size={30} />

              <input
                type="text"
                placeholder="Add a comment..."
                aria-label="Add a comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />

              <button type="submit" disabled={!comment.trim()}>
                Comment
              </button>
            </form>

            <div className="comments-list">
              {comments.length === 0 ? (
                <p className="comments-placeholder">
                  Abhi koi comment nahi hai. Pehla comment tum karo!
                </p>
              ) : (
                comments.map((item) => (
                  <div className="comment-item" key={item.id}>
                    <CircleUserRound size={28} />

                    <div className="comment-content">
                      <strong>You</strong>
                      <p>{item.text}</p>

                      {/* Comment Like button */}
                      <button
                        type="button"
                        onClick={() => handleCommentLike(item.id)}
                        aria-pressed={Boolean(item.liked)}
                        className={item.liked ? "active-action" : ""}
                        title="Like comment"
                      >
                        <ThumbsUp size={15} />
                        {item.likes || 0}
                      </button>

                      {/* Reply form */}
                      <form
                        className="add-reply"
                        onSubmit={(event) =>
                          handleReplySubmit(event, item.id)
                        }
                      >
                        <input
                          type="text"
                          placeholder="Write a reply..."
                          aria-label="Write a reply"
                          value={replyInputs[item.id] || ""}
                          onChange={(event) =>
                            handleReplyInputChange(
                              item.id,
                              event.target.value
                            )
                          }
                        />

                        <button
                          type="submit"
                          disabled={!(replyInputs[item.id] || "").trim()}
                        >
                          Reply
                        </button>
                      </form>

                      {/* Replies */}
                      {Array.isArray(item.replies) &&
                        item.replies.map((reply) => (
                          <div className="comment-reply" key={reply.id}>
                            <CircleUserRound size={22} />

                            <div>
                              <strong>You · Reply</strong>
                              <p>{reply.text}</p>

                              {/* Reply Like button */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleReplyLike(item.id, reply.id)
                                }
                                aria-pressed={Boolean(reply.liked)}
                                className={
                                  reply.liked ? "active-action" : ""
                                }
                                title="Like reply"
                              >
                                <ThumbsUp size={14} />
                                {reply.likes || 0}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Delete comment */}
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(item.id)}
                      aria-label="Delete comment"
                      title="Delete comment"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>

        {/* Related videos */}
        <aside className="related-videos">
          <h2>Related videos</h2>

          {videos
            .filter((item) => String(item.id) !== String(video.id))
            .map((item) => (
              <Link
                className="related-video-card"
                to={`/watch/${item.id}`}
                key={item.id}
              >
                <img src={item.thumbnail} alt={item.title} />

                <div>
                  <h3>{item.title}</h3>
                  <p>{item.channel}</p>
                  <p>{item.views} views</p>
                </div>
              </Link>
            ))}
        </aside>
      </main>
    </div>
  );
}

