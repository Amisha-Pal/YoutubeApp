import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clapperboard, Pencil, Trash2 } from "lucide-react";
import PageLayout from "../components/PageLayout";
import axiosClient from "../api/axiosClient";
import { categories } from "../features/videos/videoData";
import { formatVideo } from "../utils/format";
import { isLoggedIn } from "../utils/auth";

const PAGE_SIZE = 50;
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const THUMBNAIL_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EDITABLE_CATEGORIES = categories.filter((item) => item !== "All");

function EditVideoForm({ video, onSaved, onCancel }) {
  const [form, setForm] = useState({
    title: video.title,
    description: video.description || "",
    category: video.category || "Other",
    visibility: video.visibility,
  });
  const [thumbnail, setThumbnail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleThumbnail(event) {
    const file = event.target.files?.[0] || null;
    if (file && !THUMBNAIL_TYPES.includes(file.type)) {
      setError("Thumbnail must be a JPG, PNG or WEBP image.");
      event.target.value = "";
      return;
    }
    if (file && file.size > MAX_THUMBNAIL_BYTES) {
      setError("Thumbnail size cannot exceed 5 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setThumbnail(file);
  }

  function update(field) {
    return (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    try {
      setSaving(true);
      let payload = form;
      if (thumbnail) {
        payload = new FormData();
        Object.entries(form).forEach(([key, value]) => payload.append(key, value));
        payload.append("thumbnail", thumbnail);
      }
      const response = await axiosClient.patch(`videos/${video.id}/`, payload);
      onSaved(formatVideo(response.data));
    } catch (err) {
      const data = err.response?.data;
      setError(data?.title?.[0] || data?.thumbnail?.[0] || "Video could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="your-video-edit" onSubmit={handleSubmit}>
      <label>
        Title
        <input value={form.title} onChange={update("title")} maxLength={255} required />
      </label>
      <label>
        Description
        <textarea value={form.description} onChange={update("description")} rows={3} />
      </label>
      <div className="your-video-edit-row">
        <label>
          Category
          <select value={form.category} onChange={update("category")}>
            {EDITABLE_CATEGORIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Visibility
          <select value={form.visibility} onChange={update("visibility")}>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </label>
      </div>
      <label>
        Thumbnail (optional, JPG/PNG/WEBP up to 5 MB)
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleThumbnail} />
      </label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="your-video-edit-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
      </div>
    </form>
  );
}

export default function YourVideos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(isLoggedIn());
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) return undefined;
    let cancelled = false;
    axiosClient
      .get("videos/mine/", { params: { page_size: PAGE_SIZE, page: 1 } })
      .then((response) => {
        if (cancelled) return;
        const data = response.data;
        setVideos((data.results || data).map(formatVideo));
        setHasMore(Boolean(data.next));
      })
      .catch(() => !cancelled && setError("Your videos could not be loaded."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore() {
    try {
      setLoadingMore(true);
      // Derive the page from what is loaded so deletions don't skip uploads.
      const page = Math.floor(videos.length / PAGE_SIZE) + 1;
      const response = await axiosClient.get("videos/mine/", {
        params: { page_size: PAGE_SIZE, page },
      });
      setVideos((previous) => {
        const seen = new Set(previous.map((video) => video.id));
        return [
          ...previous,
          ...response.data.results
            .map(formatVideo)
            .filter((video) => !seen.has(video.id)),
        ];
      });
      setHasMore(Boolean(response.data.next));
    } catch {
      setError("More videos could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDelete(video) {
    if (!window.confirm(`Delete "${video.title}"? This cannot be undone.`)) return;
    try {
      await axiosClient.delete(`videos/${video.id}/`);
      setVideos((previous) => previous.filter((item) => item.id !== video.id));
    } catch {
      setError("Video could not be deleted.");
    }
  }

  return (
    <PageLayout>
      <section className="feed-page">
        <header className="feed-header">
          <Clapperboard size={28} />
          <h1>Your videos</h1>
        </header>

        {!isLoggedIn() ? (
          <div className="empty-results"><h2>Sign in to manage your videos</h2></div>
        ) : loading ? (
          <div className="empty-results"><h2>Loading...</h2></div>
        ) : (
          <>
            {error && <p role="alert" className="form-error">{error}</p>}
            {videos.length === 0 ? (
              <div className="empty-results">
                <h2>No uploads yet</h2>
                <p>Use the Create button to upload your first video.</p>
              </div>
            ) : (
              <div className="your-videos-list">
                {videos.map((video) => (
                  <article key={video.id} className="your-video-row">
                    <Link to={`/watch/${video.id}`} className="your-video-thumb">
                      <img src={video.thumbnail} alt={video.title} loading="lazy" />
                      {video.duration && <span className="video-duration">{video.duration}</span>}
                    </Link>
                    <div className="your-video-info">
                      {editingId === video.id ? (
                        <EditVideoForm
                          video={video}
                          onCancel={() => setEditingId(null)}
                          onSaved={(updated) => {
                            setVideos((previous) =>
                              previous.map((item) => (item.id === updated.id ? updated : item))
                            );
                            setEditingId(null);
                          }}
                        />
                      ) : (
                        <>
                          <Link to={`/watch/${video.id}`} className="your-video-title">{video.title}</Link>
                          <p className="your-video-meta">
                            <span className={`status-badge status-${video.status}`}>{video.status}</span>
                            <span className="status-badge">{video.visibility}</span>
                            {video.category} · {video.views} views · {video.uploaded}
                          </p>
                          {video.description && <p className="your-video-description">{video.description}</p>}
                        </>
                      )}
                    </div>
                    {editingId !== video.id && (
                      <div className="your-video-actions">
                        <button type="button" aria-label={`Edit ${video.title}`} onClick={() => setEditingId(video.id)}>
                          <Pencil size={18} />
                        </button>
                        <button type="button" aria-label={`Delete ${video.title}`} onClick={() => handleDelete(video)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                {hasMore && (
                  <div className="load-more-container">
                    <button type="button" className="load-more-btn" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? "Loading..." : "Load More"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </PageLayout>
  );
}
