import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clapperboard, Pencil, Trash2 } from "lucide-react";
import PageLayout from "../components/PageLayout";
import axiosClient from "../api/axiosClient";
import { categories } from "../features/videos/videoData";
import { formatVideo } from "../utils/format";
import { isLoggedIn } from "../utils/auth";

const PAGE_SIZE = 50;
const EDITABLE_CATEGORIES = categories.filter((item) => item !== "All");

function EditVideoForm({ video, onSaved, onCancel }) {
  const [form, setForm] = useState({
    title: video.title,
    description: video.description || "",
    category: video.category || "Other",
    visibility: video.visibility,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      const response = await axiosClient.patch(`videos/${video.id}/`, form);
      onSaved(formatVideo(response.data));
    } catch (err) {
      setError(err.response?.data?.title?.[0] || "Video could not be updated.");
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
  const [nextPage, setNextPage] = useState(null);
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
        setNextPage(data.next ? 2 : null);
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
      const response = await axiosClient.get("videos/mine/", {
        params: { page_size: PAGE_SIZE, page: nextPage },
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
                {nextPage && (
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
