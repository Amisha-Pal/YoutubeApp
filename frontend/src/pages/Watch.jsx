import { useWatchLater } from "../context/WatchLaterContext";
import { useState, useEffect, useRef } from "react";
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
import { videos as staticVideos } from "../features/videos/videoData";
import axiosClient from "../api/axiosClient";
import { useHistory } from "../context/HistoryContext";

export default function Watch() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const countedViewId = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchVideo() {
      try {
        setPageLoading(true);
        setPageError("");

        const response = await axiosClient.get(`videos/${id}/`);
        const data = response.data;

        setLikesCount(Number(data.likes_count) || 0);
        setDislikesCount(Number(data.dislikes_count) || 0);
        setUserReaction(data.user_reaction || null);

        const formattedVideo = {
          id: data.id,
          ownerId: data.owner,
          title: data.title,
          description: data.description,
          channel: data.owner_username,
          views: `${data.views_count} `,
          uploaded: new Date(data.created_at).toLocaleDateString(),
          videoUrl: data.video_file,
          thumbnail:
            data.thumbnail ||
            "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=640&h=360&fit=crop",
          avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
            data.owner_username
          )}`,
        };

        if (isMounted) {
          setVideo(formattedVideo);
          setRelatedVideos(staticVideos);
        }
      } catch (error) {
        console.error("Video fetch failed:", error);

        if (isMounted) {
          setPageError("Ye video abhi available nahi hai.");
        }
      } finally {
        if (isMounted) {
          setPageLoading(false);
        }
      }
    }

    fetchVideo();

    return () => {
      isMounted = false;
    };
  }, [id]);
  const { addToHistory } = useHistory();

  useEffect(() => {
    if (!video?.ownerId) return;

    async function fetchSubscription() {
      try {
        const response = await axiosClient.get(
          `videos/channels/${video.ownerId}/subscribe/`
        );

        setSubscribed(response.data.is_subscribed);
        setSubscribersCount(response.data.subscribers_count);
      } catch (error) {
        console.error("Subscription fetch failed:", error);
      }
    }

    fetchSubscription();
  }, [video?.ownerId]);

  async function handleSubscribe() {
    if (!localStorage.getItem("accessToken")) {
      setShareMessage("Subscribe karne ke liye pehle login karo.");
      return;
    }

    if (!video?.ownerId) return;

    try {
      setSubscriptionLoading(true);

      const endpoint = `videos/channels/${video.ownerId}/subscribe/`;

      const response = subscribed
        ? await axiosClient.delete(endpoint)
        : await axiosClient.post(endpoint);

      setSubscribed(response.data.is_subscribed);
      setSubscribersCount(response.data.subscribers_count);
    } catch (error) {
      console.error("Subscription failed:", error);
      setShareMessage("Subscription update nahi ho paya.");
    } finally {
      setSubscriptionLoading(false);
    }
  }

  const [userReaction, setUserReaction] = useState(null);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [reactionLoading, setReactionLoading] = useState(false);

  const [subscribed, setSubscribed] = useState(false);

  const [subscribersCount, setSubscribersCount] = useState(0);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  const { addToWatchLater, removeFromWatchLater, isInWatchLater, } = useWatchLater();

  const [shareMessage, setShareMessage] = useState("");
  const [comment, setComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [replyInputs, setReplyInputs] = useState({});
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Video ko history mein add karna
  useEffect(() => {
    if (video) {
      addToHistory(video);
    }
  }, [video, addToHistory]);

  // Comments, replies aur unke likes save karna
  useEffect(() => {
    let isMounted = true;

    async function fetchComments() {
      try {
        setCommentsLoading(true);
        setCommentError("");

        const response = await axiosClient.get(
          `videos/${id}/comments/`
        );

        if (isMounted) {
          const data = response.data;
          setComments(Array.isArray(data) ? data : data.results || []);
        }
      } catch (error) {
        console.error("Comments fetch failed:", error);

        if (isMounted) {
          setCommentError("Comments load nahi ho paye.");
        }
      } finally {
        if (isMounted) {
          setCommentsLoading(false);
        }
      }
    }

    fetchComments();

    return () => {
      isMounted = false;
    };
  }, [id]);

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
  async function handleReaction(reaction) {
    if (reactionLoading) return;

    if (
      !localStorage.getItem("accessToken") &&
      !localStorage.getItem("refreshToken")
    ) {
      setShareMessage("Like ya Dislike karne ke liye login karo.");

      window.setTimeout(() => setShareMessage(""), 3000);
      return;
    }

    setReactionLoading(true);

    try {
      const response = await axiosClient.post(
        `videos/${video.id}/reaction/`,
        {
          reaction,
        }
      );

      setLikesCount(response.data.likes_count);
      setDislikesCount(response.data.dislikes_count);
      setUserReaction(response.data.user_reaction);

    } catch (error) {
      console.error("Reaction failed:", error);

      if (error.response?.status === 401) {
        setShareMessage("Session expire ho gaya. Dobara login karo.");
      } else {
        setShareMessage(
          error.response?.data?.error ||
          "Reaction save nahi ho paya. Please try again."
        );
      }

      window.setTimeout(() => setShareMessage(""), 3000);

    } finally {
      setReactionLoading(false);
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
  async function handleCommentSubmit(event) {
    event.preventDefault();

    const text = comment.trim();

    if (!text || commentSubmitting) return;

    if (!localStorage.getItem("accessToken")) {
      setShareMessage("Comment karne ke liye login karo.");
      window.setTimeout(() => setShareMessage(""), 3000);
      return;
    }

    try {
      setCommentSubmitting(true);
      setCommentError("");

      const response = await axiosClient.post(
        `videos/${video.id}/comments/`,
        {
          content: text,
          parent: null,
        }
      );

      setComments((previous) => [
        response.data,
        ...previous,
      ]);

      setComment("");
    } catch (error) {
      console.error("Comment submission failed:", error);

      setCommentError(
        error.response?.data?.detail ||
        error.response?.data?.content?.[0] ||
        "Comment save nahi ho paya. Please try again."
      );
    } finally {
      setCommentSubmitting(false);
    }
  }

  // Comment / Reply Like and Dislike
  async function handleCommentReaction(commentId, reactionType) {
    if (!localStorage.getItem("accessToken")) {
      setShareMessage("Reaction dene ke liye login karo.");
      window.setTimeout(() => setShareMessage(""), 3000);
      return;
    }

    try {
      const response = await axiosClient.post(
        `videos/comments/${commentId}/reaction/`,
        {
          reaction: reactionType,
        }
      );

      const updatedReaction = response.data;

      setComments((previous) =>
        previous.map((item) =>
          item.id === commentId
            ? {
              ...item,
              likes_count: updatedReaction.likes_count,
              dislikes_count: updatedReaction.dislikes_count,
              user_reaction: updatedReaction.user_reaction,
            }
            : item
        )
      );
    } catch (error) {
      console.error("Comment reaction failed:", error);

      setCommentError(
        error.response?.data?.detail ||
        error.response?.data?.error ||
        "Reaction save nahi ho paya. Please try again."
      );
    }
  }

  // Reply Like and Dislike
  async function handleReplyReaction(commentId, replyId, reactionType) {
    if (!localStorage.getItem("accessToken")) {
      setShareMessage("Reaction dene ke liye login karo.");
      window.setTimeout(() => setShareMessage(""), 3000);
      return;
    }

    try {
      const response = await axiosClient.post(
        `videos/comments/${replyId}/reaction/`,
        {
          reaction: reactionType,
        }
      );

      const updatedReaction = response.data;

      setComments((previous) =>
        previous.map((item) =>
          item.id === commentId
            ? {
              ...item,
              replies: (item.replies || []).map((reply) =>
                reply.id === replyId
                  ? {
                    ...reply,
                    likes_count: updatedReaction.likes_count,
                    dislikes_count: updatedReaction.dislikes_count,
                    user_reaction: updatedReaction.user_reaction,
                  }
                  : reply
              ),
            }
            : item
        )
      );
    } catch (error) {
      console.error("Reply reaction failed:", error);

      setCommentError(
        error.response?.data?.detail ||
        error.response?.data?.error ||
        "Reply reaction save nahi ho paya. Please try again."
      );
    }
  }

  // Reply input update karna
  function handleReplyInputChange(commentId, value) {
    setReplyInputs((previous) => ({
      ...previous,
      [commentId]: value,
    }));
  }

  // Comment ka reply add karna
  async function handleReplySubmit(event, commentId) {
    event.preventDefault();

    const text = (replyInputs[commentId] || "").trim();

    if (!text) return;

    if (!localStorage.getItem("accessToken")) {
      setShareMessage("Reply karne ke liye login karo.");
      window.setTimeout(() => setShareMessage(""), 3000);
      return;
    }

    try {
      setCommentError("");

      const response = await axiosClient.post(
        `videos/${video.id}/comments/`,
        {
          content: text,
          parent: commentId,
        }
      );

      setComments((previous) =>
        previous.map((item) =>
          item.id === commentId
            ? {
              ...item,
              replies: [...(item.replies || []), response.data],
            }
            : item
        )
      );

      setReplyInputs((previous) => ({
        ...previous,
        [commentId]: "",
      }));

    } catch (error) {
      console.error("Reply submission failed:", error);

      const data = error.response?.data;

      const message =
        data?.detail ||
        data?.parent?.[0] ||
        data?.content?.[0] ||
        (data ? JSON.stringify(data) : error.message);

      setCommentError(`Reply failed: ${message}`);
    }
  }

  // Comment delete karna
  // Backend se comment delete karna
  async function handleDeleteComment(commentId) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this comment?"
    );

    if (!confirmDelete) return;

    try {
      setCommentError("");

      await axiosClient.delete(
        `videos/comments/${commentId}/`
      );

      setComments((previous) =>
        previous.filter((item) => item.id !== commentId)
      );

    } catch (error) {
      console.error("Comment deletion failed:", error);

      setCommentError(
        error.response?.data?.detail ||
        "Comment delete nahi ho paya."
      );
    }
  }

  // Comment edit karna
  function handleEditComment(item) {
    setEditingCommentId(item.id);
    setEditCommentText(item.content);
  }

  // Updated comment backend mein save karna
  async function handleUpdateComment(event) {
    event.preventDefault();

    const text = editCommentText.trim();

    if (!text || !editingCommentId) return;

    try {
      setCommentError("");

      const response = await axiosClient.patch(
        `videos/comments/${editingCommentId}/`,
        {
          content: text,
        }
      );

      setComments((previous) =>
        previous.map((item) =>
          item.id === editingCommentId
            ? { ...item, ...response.data }
            : item
        )
      );

      setEditingCommentId(null);
      setEditCommentText("");

    } catch (error) {
      console.error("Comment update failed:", error);
      console.error("Server response:", error.response?.data);

      setCommentError(
        error.response?.data?.detail ||
        error.response?.data?.content?.[0] ||
        "Comment update nahi ho paya."
      );
    }
  }

  async function handleVideoPlay() {
    if (!video) return;

    const currentVideoId = String(video.id);

    // Same page visit mein duplicate view count nahi hoga
    if (countedViewId.current === currentVideoId) return;

    countedViewId.current = currentVideoId;

    try {
      const response = await axiosClient.post(
        `videos/${video.id}/view/`
      );

      setVideo((previous) => {
        if (!previous || String(previous.id) !== currentVideoId) {
          return previous;
        }

        return {
          ...previous,
          views: response.data.views_count.toLocaleString("en-IN"),
        };
      });

      console.log("View counted:", response.data.views_count);
    } catch (error) {
      console.error("View counting failed:", error);
      countedViewId.current = null;
    }
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
                onPlay={handleVideoPlay}
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
                <p>
                  {subscribersCount.toLocaleString("en-IN")} subscribers
                </p>
              </div>

              {(() => {
                const token = localStorage.getItem("accessToken");

                if (!token) return true;

                try {
                  const payload = token
                    .split(".")[1]
                    .replace(/-/g, "+")
                    .replace(/_/g, "/");

                  const paddedPayload = payload.padEnd(
                    Math.ceil(payload.length / 4) * 4,
                    "="
                  );

                  const currentUserId = JSON.parse(
                    atob(paddedPayload)
                  ).user_id;

                  return String(video.ownerId) !== String(currentUserId);
                } catch {
                  return true;
                }
              })() && (
                  <button
                    className={`subscribe-button ${subscribed ? "subscribed" : ""}`}
                    type="button"
                    onClick={handleSubscribe}
                    disabled={subscriptionLoading}
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
                )}
            </div>

            <div className="action-buttons">
              <button
                type="button"
                className={userReaction === "like" ? "active-action" : ""}
                onClick={() => handleReaction("like")}
                aria-pressed={userReaction === "like"}
                disabled={reactionLoading}
                title="Like"
              >
                <ThumbsUp size={19} />
                Like {likesCount > 0 && likesCount.toLocaleString("en-IN")}
              </button>

              <button
                type="button"
                className={userReaction === "dislike" ? "active-action" : ""}
                onClick={() => handleReaction("dislike")}
                aria-pressed={userReaction === "dislike"}
                disabled={reactionLoading}
                title="Dislike"
              >
                <ThumbsDown size={19} />
                Dislike {dislikesCount > 0 && dislikesCount.toLocaleString("en-IN")}
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

            <h2>Comments ({comments.length})</h2>

            {commentsLoading && <p>Comments loading...</p>}

            {commentError && (
              <p role="alert">{commentError}</p>
            )}

            <form className="add-comment" onSubmit={handleCommentSubmit}>
              <CircleUserRound size={30} />

              <input
                type="text"
                placeholder="Add a comment..."
                aria-label="Add a comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />

              <button
                type="submit"
                disabled={!comment.trim() || commentSubmitting}
              >
                {commentSubmitting ? "Posting..." : "Comment"}
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
                      <strong>{item.username}</strong>

                      {editingCommentId === item.id ? (
                        <form onSubmit={handleUpdateComment}>
                          <input
                            type="text"
                            value={editCommentText}
                            onChange={(event) =>
                              setEditCommentText(event.target.value)
                            }
                            maxLength={2000}
                          />

                          <button type="submit" disabled={!editCommentText.trim()}>
                            Save
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditCommentText("");
                            }}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <p>{item.content}</p>

                          <button
                            type="button"
                            onClick={() => handleEditComment(item)}
                          >
                            Edit
                          </button>
                        </>
                      )}

                      {/* Comment Like button */}
                      <button
                        type="button"
                        onClick={() => handleCommentReaction(item.id, "like")}
                        aria-pressed={item.user_reaction === "like"}
                        className={
                          item.user_reaction === "like" ? "active-action" : ""
                        }
                        title="Like comment"
                      >
                        <ThumbsUp size={15} />
                        {item.likes_count || 0}
                      </button>

                      {/* Comment Dislike button */}
                      <button
                        type="button"
                        onClick={() => handleCommentReaction(item.id, "dislike")}
                        aria-pressed={item.user_reaction === "dislike"}
                        className={
                          item.user_reaction === "dislike" ? "active-action" : ""
                        }
                        title="Dislike comment"
                      >
                        <ThumbsDown size={15} />
                        {item.dislikes_count || 0}
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
                              <strong>{reply.username} · Reply</strong>
                              <p>{reply.content}</p>

                              {/* Reply Like button */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleReplyReaction(item.id, reply.id, "like")
                                }
                                aria-pressed={reply.user_reaction === "like"}
                                className={
                                  reply.user_reaction === "like" ? "active-action" : ""
                                }
                                title="Like reply"
                              >
                                <ThumbsUp size={14} />
                                {reply.likes_count || 0}
                              </button>

                              {/* Reply Dislike button */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleReplyReaction(item.id, reply.id, "dislike")
                                }
                                aria-pressed={reply.user_reaction === "dislike"}
                                className={
                                  reply.user_reaction === "dislike" ? "active-action" : ""
                                }
                                title="Dislike reply"
                              >
                                <ThumbsDown size={14} />
                                {reply.dislikes_count || 0}
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

          {relatedVideos
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

