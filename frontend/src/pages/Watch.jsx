import { useWatchLater } from "../context/WatchLaterContext";
import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
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
  ListPlus,
  Shuffle,
  Repeat,
  Repeat1,
} from "lucide-react";

import Navbar from "../components/Navbar";
// import { videos as staticVideos } from "../features/videos/videoData";
import axiosClient from "../api/axiosClient";
import API_ENDPOINTS from "../api/endpoints";
import { toAbsoluteMediaUrl } from "../api/config";
import { getCurrentUserId } from "../utils/auth";
import { useHistory } from "../context/HistoryContext";

export default function Watch() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const playlistQueue = location.state?.playlistQueue || [];
  const playlistId = location.state?.playlistId;
  const playlistTitle = location.state?.playlistTitle;

  const [shuffleEnabled, setShuffleEnabled] = useState(
    location.state?.shuffleEnabled || false
  );

  const [repeatMode, setRepeatMode] = useState(
    location.state?.repeatMode || "off"
  );

  const originalPlaylistQueue =
    location.state?.originalPlaylistQueue || playlistQueue;
  const currentPlaylistIndex = playlistQueue.findIndex(
    (item) => String(item.video) === String(id)
  );

  // Playlist ke kisi video par navigate karna
  const handlePlaylistNavigation = (index, shouldAutoplay = true) => {
    if (index < 0 || index >= playlistQueue.length) return;

    const nextVideo = playlistQueue[index];

    navigate(`/watch/${nextVideo.video}`, {
      state: {
        playlistQueue,
        originalPlaylistQueue,
        playlistId,
        playlistTitle,
        shuffleEnabled,
        repeatMode,
        autoplay: shouldAutoplay,
      },
    });
  };

  // Next video
  const handleNextVideo = () => {
    if (currentPlaylistIndex < playlistQueue.length - 1) {
      handlePlaylistNavigation(currentPlaylistIndex + 1);
    } else if (repeatMode === "all" && playlistQueue.length > 0) {
      handlePlaylistNavigation(0);
    }
  };

  // Previous video
  const handlePreviousVideo = () => {
    if (currentPlaylistIndex > 0) {
      handlePlaylistNavigation(currentPlaylistIndex - 1);
    }
  };

  // Shuffle ON/OFF
  const handleToggleShuffle = () => {
    if (!shuffleEnabled) {
      const currentVideo = playlistQueue[currentPlaylistIndex];

      const shuffledVideos = [...originalPlaylistQueue].filter(
        (item) => String(item.video) !== String(id)
      );

      // Fisher-Yates shuffle
      for (let i = shuffledVideos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledVideos[i], shuffledVideos[j]] = [
          shuffledVideos[j],
          shuffledVideos[i],
        ];
      }

      const newQueue = currentVideo
        ? [currentVideo, ...shuffledVideos]
        : shuffledVideos;

      setShuffleEnabled(true);

      navigate(`/watch/${id}`, {
        state: {
          playlistQueue: newQueue,
          originalPlaylistQueue,
          playlistId,
          playlistTitle,
          shuffleEnabled: true,
          repeatMode,
          autoplay: false,
        },
      });
    } else {
      setShuffleEnabled(false);

      navigate(`/watch/${id}`, {
        state: {
          playlistQueue: originalPlaylistQueue,
          originalPlaylistQueue,
          playlistId,
          playlistTitle,
          shuffleEnabled: false,
          repeatMode,
          autoplay: false,
        },
      });
    }
  };

  // Repeat mode: Off -> All -> One -> Off
  const handleToggleRepeat = () => {
    const nextMode =
      repeatMode === "off"
        ? "all"
        : repeatMode === "all"
          ? "one"
          : "off";

    setRepeatMode(nextMode);

    navigate(`/watch/${id}`, {
      state: {
        playlistQueue,
        originalPlaylistQueue,
        playlistId,
        playlistTitle,
        shuffleEnabled,
        repeatMode: nextMode,
        autoplay: false,
      },
    });
  };

  const [autoplayEnabled, setAutoplayEnabled] = useState(
    () => localStorage.getItem("autoplayEnabled") !== "false"
  );

  const [userReaction, setUserReaction] = useState(null);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [reactionLoading, setReactionLoading] = useState(false);

  const [subscribed, setSubscribed] = useState(false);

  const [subscribersCount, setSubscribersCount] = useState(0);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  // Video khatam hone par automatically next video
  // Video complete hone par Repeat / Auto Next
  const handlePlaylistVideoEnded = (event) => {
    // Autoplay OFF hai to video khatam hone par ruk jao
    if (!autoplayEnabled) {
      return;
    }

    // Repeat One: current video dobara play karo
    if (repeatMode === "one") {
      event.currentTarget.currentTime = 0;
      event.currentTarget.play();
      return;
    }

    // Next video available hai
    if (currentPlaylistIndex < playlistQueue.length - 1) {
      handlePlaylistNavigation(currentPlaylistIndex + 1, true);
      return;
    }

    // Repeat All: playlist ke first video par wapas jao
    if (repeatMode === "all" && playlistQueue.length > 0) {
      handlePlaylistNavigation(0, true);
    }
  };

  const [video, setVideo] = useState(null);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const countedViewId = useRef(null);

  const videoRef = useRef(null);

  const [selectedQuality, setSelectedQuality] = useState("Auto");
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);

  const [activeVideoUrl, setActiveVideoUrl] = useState("");
  const pendingPlaybackRef = useRef(null);

  const handleQualityChange = (event) => {
    const quality = event.target.value;
    const videoElement = videoRef.current;

    if (!videoElement || !video) return;

    const selectedUrl =
      quality === "Auto"
        ? video.videoUrl
        : video.videoQualities?.[quality];

    if (!selectedUrl) return;

    const qualityUrl = toAbsoluteMediaUrl(selectedUrl);

    if (qualityUrl === videoElement.currentSrc) {
      setSelectedQuality(quality);
      return;
    }


    pendingPlaybackRef.current = {
      currentTime: videoElement.currentTime,
      wasPlaying: !videoElement.paused,
    };

    setSelectedQuality(quality);
    setActiveVideoUrl(qualityUrl);
  };

  useEffect(() => {
    const handlePiPEnter = () => {
      setIsPictureInPicture(true);
    };

    const handlePiPLeave = () => {
      setIsPictureInPicture(false);
    };

    document.addEventListener(
      "enterpictureinpicture",
      handlePiPEnter
    );

    document.addEventListener(
      "leavepictureinpicture",
      handlePiPLeave
    );

    return () => {
      document.removeEventListener(
        "enterpictureinpicture",
        handlePiPEnter
      );

      document.removeEventListener(
        "leavepictureinpicture",
        handlePiPLeave
      );
    };
  }, []);

  const handlePictureInPicture = async () => {
    const videoElement = videoRef.current;

    if (!videoElement) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoElement.requestPictureInPicture();
      }
    } catch (error) {
      console.error("Picture-in-Picture error:", error);
    }
  };

  const [playbackSpeed, setPlaybackSpeed] = useState(1);


  const [theaterMode, setTheaterMode] = useState(false);

  const handleToggleTheaterMode = () => {
    setTheaterMode((previous) => !previous);
  };

  // Video Player Keyboard Shortcuts
  useEffect(() => {
    const handleKeyboardShortcuts = (event) => {
      const videoElement = videoRef.current;

      if (!videoElement) return;

      // Input fields mein shortcuts disable
      const tagName = event.target.tagName;

      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(tagName) ||
        event.target.isContentEditable
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();

          if (videoElement.paused) {
            videoElement.play();
          } else {
            videoElement.pause();
          }
          break;

        case "arrowleft":
          event.preventDefault();
          videoElement.currentTime = Math.max(
            0,
            videoElement.currentTime - 5
          );
          break;

        case "arrowright":
          event.preventDefault();
          videoElement.currentTime = Math.min(
            videoElement.duration || Infinity,
            videoElement.currentTime + 5
          );
          break;

        case "arrowup":
          event.preventDefault();
          videoElement.volume = Math.min(
            1,
            videoElement.volume + 0.05
          );
          break;

        case "arrowdown":
          event.preventDefault();
          videoElement.volume = Math.max(
            0,
            videoElement.volume - 0.05
          );
          break;

        case "m":
          videoElement.muted = !videoElement.muted;
          break;

        case "t":
          handleToggleTheaterMode();
          break;

        case "f":
          event.preventDefault();

          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            videoElement.requestFullscreen();
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcuts);

    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, []);

  const handleToggleAutoplay = () => {
    setAutoplayEnabled((previous) => {
      const next = !previous;
      localStorage.setItem("autoplayEnabled", String(next));
      return next;
    });
  };

  const playbackSpeeds = [
    0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2,
  ];

  function handlePlaybackSpeedChange(event) {
    const speed = Number(event.target.value);
    setPlaybackSpeed(speed);

    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }

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
          category: data.category,
          status: data.status,
          visibility: data.visibility,
          channel: data.owner_username,
          views: `${data.views_count} `,
          uploaded: new Date(data.created_at).toLocaleDateString(),
          videoUrl: data.video_file,
          videoQualities: data.video_qualities || {},
          thumbnail:
            data.thumbnail ||
            "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=640&h=360&fit=crop",
          avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
            data.owner_username
          )}`,
        };

        if (isMounted) {
          setVideo(formattedVideo);
        }

        // Related videos Backend API se fetch karna
        try {
          const relatedResponse = await axiosClient.get("videos/", {
            params: {
              category: data.category,
              page: 1,
            },
          });

          const relatedData = relatedResponse.data.results || relatedResponse.data;

          const formattedRelatedVideos = relatedData
            .filter((item) => String(item.id) !== String(data.id))
            .sort(
              (a, b) =>
                Number(b.views_count || 0) - Number(a.views_count || 0)
            )
            .map((item) => ({
              id: item.id,
              title: item.title,
              channel: item.owner_username,
              views: Number(item.views_count || 0).toLocaleString("en-IN"),
              thumbnail:
                item.thumbnail ||
                "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=640&h=360&fit=crop",
            }));

          if (isMounted) {
            setRelatedVideos(formattedRelatedVideos);
          }
        } catch (relatedError) {
          console.error("Related videos fetch failed:", relatedError);

          if (isMounted) {
            setRelatedVideos([]);
          }
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

    const accessToken = localStorage.getItem("accessToken");

    // Login nahi hai toh API call mat karo
    if (!accessToken) return;

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


  const { addToWatchLater, removeFromWatchLater, isInWatchLater, } = useWatchLater();

  const [shareMessage, setShareMessage] = useState("");
  // Playlist states
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistSaving, setPlaylistSaving] = useState(false);
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
          {pageLoading ? (
            <p role="status">Loading video...</p>
          ) : (
            <>
              <h2>Video not found</h2>
              <p>{pageError || "Ye video abhi available nahi hai."}</p>
            </>
          )}
          <Link to="/">Go to Home</Link>
        </main>
      </div>
    );
  }

  const currentUserId = getCurrentUserId();
  const isVideoOwner = String(video.ownerId) === String(currentUserId);

  async function handleDeleteReply(parentId, replyId) {
    if (!window.confirm("Delete this reply?")) return;

    try {
      await axiosClient.delete(`videos/comments/${replyId}/`);
      setComments((previous) =>
        previous.map((item) =>
          item.id === parentId
            ? {
                ...item,
                replies: (item.replies || []).filter(
                  (reply) => reply.id !== replyId
                ),
              }
            : item
        )
      );
    } catch (error) {
      console.error("Reply delete failed:", error);
      setCommentError("Reply delete nahi ho paya.");
    }
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

  // User ki playlists fetch karna
  async function handleOpenPlaylistPicker() {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      setShareMessage("Playlist mein save karne ke liye pehle login karo.");
      return;
    }

    setPlaylistLoading(true);
    setShowPlaylistPicker(true);

    try {
      const response = await axiosClient.get(API_ENDPOINTS.PLAYLISTS.LIST, {
        params: { owner: "me" },
      });

      const myPlaylists = response.data.results || response.data;

      setUserPlaylists(myPlaylists);
    } catch (error) {
      console.error("Playlists fetch failed:", error);
      setShareMessage("Playlists load nahi ho payi.");
      setShowPlaylistPicker(false);
    } finally {
      setPlaylistLoading(false);
    }
  }

  // Video ko selected playlist mein add karna
  async function handleSaveToPlaylist(playlistId) {
    if (playlistSaving) return;

    setPlaylistSaving(true);

    try {
      await axiosClient.post(
        API_ENDPOINTS.PLAYLISTS.ADD_VIDEO(playlistId),
        {
          video_id: video.id,
        }
      );

      setShareMessage("Video playlist mein successfully save ho gayi!");
      setShowPlaylistPicker(false);
    } catch (error) {
      console.error("Save to playlist failed:", error);

      const message = error.response?.data?.detail;

      setShareMessage(
        message || "Video playlist mein save nahi ho payi."
      );
    } finally {
      setPlaylistSaving(false);
    }
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
  async function handleDownload() {
    if (!video.videoUrl) {
      setShareMessage("Is video ka download URL available nahi hai.");
      window.setTimeout(() => setShareMessage(""), 3000);
      return;
    }

    try {
      setShareMessage("Video download ho rahi hai...");

      const response = await fetch(video.videoUrl);

      if (!response.ok) {
        throw new Error("Video download failed");
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${video.title || "video"}.mp4`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);

      setShareMessage("Video download start ho gayi!");
    } catch (error) {
      console.error("Download error:", error);
      setShareMessage("Video download nahi ho payi.");
    }
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
    } catch (error) {
      console.error("View counting failed:", error);
      countedViewId.current = null;
    }
  }

  return (
    <div className="app-shell">
      <Navbar />

      <main className={`watch-layout ${theaterMode ? "theater-mode" : ""}`}>
        <section className="watch-main">
          {/* Video player */}
          <div className="player-container">
            {video.videoUrl ? (
              <video
                key={video.id}
                ref={videoRef}
                controls
                playsInline
                autoPlay={Boolean(location.state?.autoplay)}
                onEnded={handlePlaylistVideoEnded}
                poster={video.thumbnail}
                src={activeVideoUrl || video.videoUrl}
                onLoadedMetadata={() => {
                  const pending = pendingPlaybackRef.current;
                  const videoElement = videoRef.current;

                  if (!pending || !videoElement) return;

                  const targetTime = Math.min(
                    pending.currentTime,
                    Math.max(0, videoElement.duration - 1)
                  );


                  // Seek ko thoda delay karke browser ko metadata process karne do.
                  requestAnimationFrame(() => {
                    videoElement.currentTime = targetTime;
                  });
                }}

                onSeeked={() => {
                  const pending = pendingPlaybackRef.current;
                  const videoElement = videoRef.current;

                  if (!pending || !videoElement) return;


                  // Position sahi restore hone par hi pending clear karo.
                  if (Math.abs(videoElement.currentTime - pending.currentTime) < 1) {
                    pendingPlaybackRef.current = null;

                    if (pending.wasPlaying) {
                      videoElement.play().catch(console.error);
                    }
                  }
                }}
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

          <div className="watch-player-settings">
            <div className="playback-speed-control">
              <label htmlFor="playback-speed">Playback Speed:</label>

              <select
                id="playback-speed"
                value={playbackSpeed}
                onChange={handlePlaybackSpeedChange}
              >
                {playbackSpeeds.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed === 1 ? "Normal" : `${speed}x`}
                  </option>
                ))}
              </select>
            </div>

            <div className="video-quality-control">
              <label htmlFor="video-quality">Quality:</label>

              <select
                id="video-quality"
                value={selectedQuality}
                onChange={handleQualityChange}
              >
                <option value="Auto">Auto</option>

                {["360p", "480p", "720p", "1080p"].map((quality) =>
                  video.videoQualities?.[quality] ? (
                    <option key={quality} value={quality}>
                      {quality}
                    </option>
                  ) : null
                )}
              </select>
            </div>

            <div className="autoplay-control">
              <span>Autoplay</span>

              <button
                type="button"
                className={`autoplay-toggle ${autoplayEnabled ? "active" : ""}`}
                onClick={handleToggleAutoplay}
                aria-label={`Turn autoplay ${autoplayEnabled ? "off" : "on"}`}
                aria-pressed={autoplayEnabled}
              >
                <span className="autoplay-toggle-knob" />
              </button>

              <span>{autoplayEnabled ? "On" : "Off"}</span>
            </div>
            <button
              type="button"
              className="pip-button"
              onClick={handlePictureInPicture}
              disabled={
                !document.pictureInPictureEnabled ||
                !video.videoUrl
              }
              title={
                isPictureInPicture
                  ? "Exit Picture-in-Picture"
                  : "Enter Picture-in-Picture"
              }
            >
              {isPictureInPicture ? "Exit PiP" : "Picture in Picture"}
            </button>
            <button
              type="button"
              className={`theater-mode-button ${theaterMode ? "active" : ""}`}
              onClick={handleToggleTheaterMode}
              aria-pressed={theaterMode}
              title={theaterMode ? "Exit Theater Mode" : "Enter Theater Mode"}
            >
              {theaterMode ? "Exit Theater Mode" : "Theater Mode"}
            </button>
          </div>

          {videoLoading && video.videoUrl && !videoError && (
            <p role="status">Video load ho rahi hai...</p>
          )}

          {videoError && (
            <p role="alert">
              Video load nahi ho payi. Internet ya video URL check karo.
            </p>
          )}

          {/* Playlist Player Controls */}
          {playlistQueue.length > 0 && (
            <div className="watch-playlist-container">
              <div className="watch-playlist-header">
                <div>
                  <h3>{playlistTitle || "Playlist"}</h3>
                  <p>
                    {currentPlaylistIndex + 1} of {playlistQueue.length} videos
                  </p>
                </div>

                <div className="watch-playlist-controls">
                  <button
                    type="button"
                    onClick={handlePreviousVideo}
                    disabled={currentPlaylistIndex <= 0}
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={handleNextVideo}
                    disabled={currentPlaylistIndex >= playlistQueue.length - 1}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className={shuffleEnabled ? "playlist-mode-active" : ""}
                    onClick={handleToggleShuffle}
                    title={shuffleEnabled ? "Turn Shuffle Off" : "Turn Shuffle On"}
                  >
                    <Shuffle size={18} />
                    Shuffle
                  </button>

                  <button
                    type="button"
                    className={repeatMode !== "off" ? "playlist-mode-active" : ""}
                    onClick={handleToggleRepeat}
                    title={`Repeat: ${repeatMode}`}
                  >
                    {repeatMode === "one" ? (
                      <Repeat1 size={18} />
                    ) : (
                      <Repeat size={18} />
                    )}
                    {repeatMode === "off"
                      ? "Repeat Off"
                      : repeatMode === "all"
                        ? "Repeat All"
                        : "Repeat One"}
                  </button>
                </div>
              </div>

              <div className="watch-playlist-queue">
                {playlistQueue.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className={
                      String(item.video) === String(id)
                        ? "watch-playlist-item active"
                        : "watch-playlist-item"
                    }
                    onClick={() => handlePlaylistNavigation(index)}
                  >
                    <span>{index + 1}</span>
                    <span>{item.video_title}</span>
                    {String(item.video) === String(id) && (
                      <span className="now-playing-label">Playing</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
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

              {!isVideoOwner && (
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
                onClick={handleOpenPlaylistPicker}
                title="Save to Playlist"
              >
                <ListPlus size={19} />
                Save to Playlist
              </button>

              <button
                type="button"
                onClick={handleWatchLater}
                className={isInWatchLater(video.id) ? "active-action" : ""}
                aria-pressed={isInWatchLater(video.id)}
                title={
                  isInWatchLater(video.id)
                    ? "Remove from Watch Later"
                    : "Save to Watch Later"
                }
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

          {/* Save to Playlist Popup */}
          {showPlaylistPicker && (
            <div className="playlist-picker-overlay">
              <div className="playlist-picker-modal">
                <div className="playlist-picker-header">
                  <h3>Save to Playlist</h3>

                  <button
                    type="button"
                    onClick={() => setShowPlaylistPicker(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {playlistLoading ? (
                  <p>Loading playlists...</p>
                ) : userPlaylists.length === 0 ? (
                  <div className="playlist-picker-empty">
                    <p>Abhi tumhari koi playlist nahi hai.</p>

                    <Link
                      to="/playlists"
                      onClick={() => setShowPlaylistPicker(false)}
                    >
                      Create Playlist
                    </Link>
                  </div>
                ) : (
                  <div className="playlist-picker-list">
                    {userPlaylists.map((playlist) => (
                      <button
                        type="button"
                        key={playlist.id}
                        disabled={playlistSaving}
                        onClick={() => handleSaveToPlaylist(playlist.id)}
                      >
                        <ListPlus size={18} />
                        <span>{playlist.title}</span>
                        <span>{playlist.videos_count} videos</span>
                      </button>
                    ))}
                  </div>
                )}

                {playlistSaving && <p>Saving video...</p>}
              </div>
            </div>
          )}

          {/* Video description */}
          <div className="watch-description">
            <p>
              {video.views} views · {video.uploaded}
            </p>

            {video.category && <p><strong>{video.category}</strong></p>}

            <p className="watch-description-text">
              {video.description || "No description provided."}
            </p>
          </div>

          {/* Comments section */}
          <section className="comments-section">
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

                          {String(item.user) === String(currentUserId) && (
                            <button
                              type="button"
                              onClick={() => handleEditComment(item)}
                            >
                              Edit
                            </button>
                          )}
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

                              {(String(reply.user) === String(currentUserId) ||
                                isVideoOwner) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReply(item.id, reply.id)}
                                  aria-label="Delete reply"
                                  title="Delete reply"
                                >
                                  Delete
                                </button>
                              )}

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

                    {/* Delete comment: author or video owner */}
                    {(String(item.user) === String(currentUserId) ||
                      isVideoOwner) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(item.id)}
                        aria-label="Delete comment"
                        title="Delete comment"
                      >
                        Delete
                      </button>
                    )}
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

