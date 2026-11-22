import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ListVideo,
  Plus,
  Trash2,
  LoaderCircle,
  Lock,
  Globe,
} from "lucide-react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import axiosClient from "../api/axiosClient";
import API_ENDPOINTS from "../api/endpoints";

export default function Playlists() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [creating, setCreating] = useState(false);

  const fetchPlaylists = async () => {
    try {
      const response = await axiosClient.get(API_ENDPOINTS.PLAYLISTS.LIST, {
        params: { owner: "me" },
      });
      setPlaylists(response.data.results || response.data);
      setError("");
    } catch (err) {
      console.error("Playlist fetch error:", err);
      setError(
        err.response?.data?.detail ||
          "Unable to load playlists. Please login and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchPlaylists, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleCreatePlaylist = async (event) => {
    event.preventDefault();

    if (!title.trim()) {
      setError("Please enter a playlist title.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      await axiosClient.post(API_ENDPOINTS.PLAYLISTS.LIST, {
        title: title.trim(),
        description: description.trim(),
        visibility,
      });

      setTitle("");
      setDescription("");
      setVisibility("public");
      setShowCreateForm(false);

      await fetchPlaylists();
    } catch (err) {
      console.error("Playlist creation error:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.title?.[0] ||
          "Unable to create playlist."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this playlist?"
    );

    if (!confirmed) return;

    try {
      await axiosClient.delete(
        API_ENDPOINTS.PLAYLISTS.DETAIL(playlistId)
      );

      setPlaylists((previous) =>
        previous.filter((playlist) => playlist.id !== playlistId)
      );
    } catch (err) {
      console.error("Playlist delete error:", err);
      setError(
        err.response?.data?.detail || "Unable to delete playlist."
      );
    }
  };

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
          className={`main-content ${
            sidebarOpen ? "sidebar-expanded" : "sidebar-mini"
          }`}
        >
          <section className="playlists-page">
            <div className="playlists-heading">
              <div>
                <h1>
                  <ListVideo size={30} />
                  Your Playlists
                </h1>
                <p>{playlists.length} playlists</p>
              </div>

              <button
                type="button"
                className="create-playlist-button"
                onClick={() => {
                  setShowCreateForm((previous) => !previous);
                  setError("");
                }}
              >
                <Plus size={20} />
                Create playlist
              </button>
            </div>

            {error && <p className="playlist-error">{error}</p>}

            {showCreateForm && (
              <form
                className="playlist-create-form"
                onSubmit={handleCreatePlaylist}
              >
                <h2>Create a new playlist</h2>

                <input
                  type="text"
                  placeholder="Playlist title"
                  value={title}
                  maxLength={200}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />

                <textarea
                  placeholder="Description (optional)"
                  value={description}
                  maxLength={1000}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  rows={3}
                />

                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value)}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>

                <div className="playlist-form-actions">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </button>

                  <button type="submit" disabled={creating}>
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="playlist-loading">
                <LoaderCircle size={30} className="playlist-spinner" />
                <p>Loading playlists...</p>
              </div>
            ) : playlists.length === 0 ? (
              <div className="playlists-empty">
                <ListVideo size={65} strokeWidth={1.3} />
                <h2>No playlists yet</h2>
                <p>Create a playlist to organize your favorite videos.</p>
              </div>
            ) : (
              <div className="playlists-grid">
                {playlists.map((playlist) => (
                  <article className="playlist-card" key={playlist.id}>
                    <Link
                      to={`/playlists/${playlist.id}`}
                      className="playlist-card-content"
                    >
                      <div className="playlist-card-thumbnail">
                        {playlist.videos?.[0]?.video_thumbnail ? (
                          <img
                            src={
                              playlist.videos[0].video_thumbnail.startsWith(
                                "http"
                              )
                                ? playlist.videos[0].video_thumbnail
                                : `http://127.0.0.1:8000${playlist.videos[0].video_thumbnail}`
                            }
                            alt={playlist.title}
                          />
                        ) : (
                          <ListVideo size={55} />
                        )}

                        <span>
                          <ListVideo size={15} />
                          {playlist.videos_count} videos
                        </span>
                      </div>

                      <h2>{playlist.title}</h2>

                      <p className="playlist-description">
                        {playlist.description || "No description"}
                      </p>

                      <small>
                        {playlist.visibility === "private" ? (
                          <Lock size={14} />
                        ) : (
                          <Globe size={14} />
                        )}
                        {playlist.visibility}
                      </small>
                    </Link>

                    <button
                      type="button"
                      className="playlist-delete-button"
                      title="Delete playlist"
                      onClick={() => handleDeletePlaylist(playlist.id)}
                    >
                      <Trash2 size={19} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}