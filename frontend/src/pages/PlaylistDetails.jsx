import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ListVideo,
  Trash2,
  Play,
  LoaderCircle,
  Lock,
  Globe,
  ArrowLeft,
  Pencil,
  Save,
  X,
} from "lucide-react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import axiosClient from "../api/axiosClient";
import API_ENDPOINTS from "../api/endpoints";
import { getCurrentUserId } from "../utils/auth";

export default function PlaylistDetails() {
  const { playlistId } = useParams();

  const navigate = useNavigate();

  const handlePlayAll = () => {
    if (!playlist?.videos?.length) return;

    navigate(`/watch/${playlist.videos[0].video}`, {
      state: {
        playlistQueue: playlist.videos,
        playlistId: playlist.id,
        playlistTitle: playlist.title,
        autoplay: true,
      },
    });
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState("public");
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [draggedVideoId, setDraggedVideoId] = useState(null);
  const [reordering, setReordering] = useState(false);

  const currentUserId = getCurrentUserId();

  const isPlaylistOwner =
    playlist &&
    String(playlist.owner) === String(currentUserId);

  const fetchPlaylist = async () => {
    try {
      const response = await axiosClient.get(
        API_ENDPOINTS.PLAYLISTS.DETAIL(playlistId)
      );

      setPlaylist(response.data);
      setError("");
    } catch (err) {
      console.error("Playlist detail error:", err);

      setError(
        err.response?.data?.detail ||
        "Unable to load this playlist."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchPlaylist, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  // Playlist update karna
  const handleUpdatePlaylist = async (e) => {
    e.preventDefault();

    if (!editTitle.trim()) {
      setError("Playlist title is required.");
      return;
    }

    setSavingPlaylist(true);
    setError("");

    try {
      const response = await axiosClient.patch(
        API_ENDPOINTS.PLAYLISTS.DETAIL(playlistId),
        {
          title: editTitle.trim(),
          description: editDescription.trim(),
          visibility: editVisibility,
        }
      );

      setPlaylist(response.data);
      setIsEditing(false);
    } catch (err) {
      console.error("Update playlist error:", err);

      setError(
        err.response?.data?.detail ||
        "Unable to update playlist."
      );
    } finally {
      setSavingPlaylist(false);
    }
  };

  // Complete playlist delete karna
  const handleDeletePlaylist = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${playlist.title}"?`
    );

    if (!confirmed) return;

    try {
      await axiosClient.delete(
        API_ENDPOINTS.PLAYLISTS.DETAIL(playlistId)
      );

      window.location.href = "/playlists";
    } catch (err) {
      console.error("Delete playlist error:", err);

      setError(
        err.response?.data?.detail ||
        "Unable to delete playlist."
      );
    }
  };

  const handleRemoveVideo = async (videoId) => {
    const confirmed = window.confirm(
      "Remove this video from the playlist?"
    );

    if (!confirmed) return;

    try {
      await axiosClient.delete(
        API_ENDPOINTS.PLAYLISTS.REMOVE_VIDEO(playlistId, videoId)
      );

      setPlaylist((previous) => ({
        ...previous,
        videos: previous.videos.filter(
          (item) => item.video !== videoId
        ),
        videos_count: Math.max(0, previous.videos_count - 1),
      }));
    } catch (err) {
      console.error("Remove video error:", err);

      setError(
        err.response?.data?.detail ||
        "Unable to remove video."
      );
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (event, videoId) => {
    setDraggedVideoId(videoId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(videoId));
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (event, targetVideoId) => {
    event.preventDefault();

    if (
      !draggedVideoId ||
      draggedVideoId === targetVideoId ||
      !isPlaylistOwner
    ) {
      return;
    }

    const previousVideos = [...playlist.videos];

    const reorderedVideos = [...previousVideos];

    const draggedIndex = reorderedVideos.findIndex(
      (item) => item.video === draggedVideoId
    );

    const targetIndex = reorderedVideos.findIndex(
      (item) => item.video === targetVideoId
    );

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [movedVideo] = reorderedVideos.splice(draggedIndex, 1);

    reorderedVideos.splice(targetIndex, 0, movedVideo);

    setPlaylist((previous) => ({
      ...previous,
      videos: reorderedVideos,
    }));

    setDraggedVideoId(null);
    setReordering(true);
    setError("");

    try {
      await axiosClient.post(
        API_ENDPOINTS.PLAYLISTS.REORDER(playlistId),
        {
          video_ids: reorderedVideos.map((item) => item.video),
        }
      );
    } catch (err) {
      console.error("Playlist reorder failed:", err);

      setPlaylist((previous) => ({
        ...previous,
        videos: previousVideos,
      }));

      setError("Unable to reorder playlist. Please try again.");
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <Navbar
          onMenuClick={() => setSidebarOpen((previous) => !previous)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="app-body">
          <Sidebar isOpen={sidebarOpen} />

          <main className="main-content sidebar-expanded">
            <div className="playlist-loading">
              <LoaderCircle size={30} />
              <p>Loading playlist...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="app-shell">
        <Navbar
          onMenuClick={() => setSidebarOpen((previous) => !previous)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="app-body">
          <Sidebar isOpen={sidebarOpen} />

          <main className="main-content sidebar-expanded">
            <div className="playlist-error">
              {error || "Playlist not found."}
              <p>
                <Link to="/playlists">Back to Playlists</Link>
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
          <section className="playlist-details-page">
            <Link to="/playlists" className="playlist-back-link">
              <ArrowLeft size={19} />
              Back to Playlists
            </Link>

            <div className="playlist-details-heading">
              <div className="playlist-details-icon">
                <ListVideo size={45} />
              </div>

              <div>
                <h1>{playlist.title}</h1>

                {isPlaylistOwner && !isEditing && (
                  <div className="playlist-heading-actions">
                    <button
                      type="button"
                      className="playlist-edit-button"
                      onClick={() => {
                        setEditTitle(playlist.title);
                        setEditDescription(playlist.description || "");
                        setEditVisibility(playlist.visibility);
                        setIsEditing(true);
                        setError("");
                      }}
                    >
                      <Pencil size={16} />
                      Edit Playlist
                    </button>

                    <button
                      type="button"
                      className="playlist-delete-main-button"
                      onClick={handleDeletePlaylist}
                    >
                      <Trash2 size={16} />
                      Delete Playlist
                    </button>
                  </div>
                )}

                <p>
                  {playlist.owner_username} · {playlist.videos_count} videos
                </p>

                <p>
                  {playlist.description || "No description"}
                </p>

                <span>
                  {playlist.visibility === "private" ? (
                    <Lock size={14} />
                  ) : (
                    <Globe size={14} />
                  )}
                  {playlist.visibility}
                </span>
              </div>
            </div>

            {playlist.videos.length > 0 && (
              <button
                type="button"
                className="playlist-play-all-button"
                onClick={handlePlayAll}
              >
                <Play size={19} fill="currentColor" />
                Play All
              </button>
            )}

            {isEditing && (
              <form
                className="playlist-edit-form"
                onSubmit={handleUpdatePlaylist}
              >
                <h2>Edit Playlist</h2>

                <div className="playlist-form-group">
                  <label>Playlist Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Enter playlist title"
                    maxLength={100}
                    required
                  />
                </div>

                <div className="playlist-form-group">
                  <label>Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Enter playlist description"
                    rows={3}
                  />
                </div>

                <div className="playlist-form-group">
                  <label>Visibility</label>
                  <select
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(e.target.value)}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div className="playlist-form-actions">
                  <button
                    type="submit"
                    className="playlist-save-button"
                    disabled={savingPlaylist}
                  >
                    <Save size={17} />
                    {savingPlaylist ? "Saving..." : "Save Changes"}
                  </button>

                  <button
                    type="button"
                    className="playlist-cancel-button"
                    onClick={() => {
                      setIsEditing(false);
                      setError("");
                    }}
                    disabled={savingPlaylist}
                  >
                    <X size={17} />
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {error && <p className="playlist-error">{error}</p>}

            {playlist.videos.length === 0 ? (
              <div className="playlists-empty">
                <ListVideo size={65} strokeWidth={1.3} />
                <h2>This playlist is empty</h2>
                <p>Add videos to see them here.</p>
                <Link to="/" className="playlist-explore-button">
                  Explore videos
                </Link>
              </div>
            ) : (
              <div className="playlist-details-list">
                {playlist.videos.map((item, index) => {
                  const thumbnail = item.video_thumbnail
                    ? item.video_thumbnail.startsWith("http")
                      ? item.video_thumbnail
                      : `http://127.0.0.1:8000${item.video_thumbnail}`
                    : "";

                  return (
                    <article
                      className={`playlist-detail-video ${draggedVideoId === item.video ? "playlist-video-dragging" : ""
                        }`}
                      key={item.id}
                      draggable={isPlaylistOwner && !reordering}
                      onDragStart={(event) => handleDragStart(event, item.video)}
                      onDragOver={handleDragOver}
                      onDrop={(event) => handleDrop(event, item.video)}
                      onDragEnd={() => setDraggedVideoId(null)}
                    >
                      <span className="playlist-video-number">
                        {isPlaylistOwner ? "⠿ " : ""}
                        {index + 1}
                      </span>

                      <Link
                        to={`/watch/${item.video}`}
                        className="playlist-detail-thumbnail"
                      >
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={item.video_title}
                            loading="lazy"
                          />
                        ) : (
                          <ListVideo size={40} />
                        )}

                        <span>
                          <Play size={20} fill="white" />
                        </span>
                      </Link>

                      <div className="playlist-detail-info">
                        <Link to={`/watch/${item.video}`}>
                          {item.video_title}
                        </Link>

                        <p>{item.owner_username}</p>
                      </div>

                      <button
                        type="button"
                        className="playlist-delete-button"
                        title="Remove video"
                        onClick={() => handleRemoveVideo(item.video)}
                      >
                        <Trash2 size={19} />
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
