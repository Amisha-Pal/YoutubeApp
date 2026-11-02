
import { useEffect, useState } from "react";
import { X, UploadCloud, FileVideo } from "lucide-react";
import axiosClient from "../api/axiosClient";
import API_ENDPOINTS from "../api/endpoints";

export default function UploadModal({ isOpen, onClose }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Education");
  const [visibility, setVisibility] = useState("public");
  const [selectedFile, setSelectedFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selectedFile) {
      setVideoPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    setVideoPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedFile]);

  useEffect(() => {
    if (!thumbnail) {
      setThumbnailPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(thumbnail);
    setThumbnailPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [thumbnail]);

  if (!isOpen) return null;

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategory("Education");
    setVisibility("public");
    setSelectedFile(null);
    setThumbnail(null);
    setMessage("");
  }

  function handleClose() {
    if (loading) return;

    resetForm();
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!selectedFile) {
      setMessage("Please select a video file.");
      return;
    }

    if (!selectedFile.type.startsWith("video/")) {
      setMessage("Please select a valid video file.");
      return;
    }

    if (selectedFile.size === 0) {
      setMessage("Selected video file is empty.");
      return;
    }

    const MAX_FILE_SIZE = 500 * 1024 * 1024;

    if (selectedFile.size > MAX_FILE_SIZE) {
      setMessage("Video size 500 MB se kam honi chahiye.");
      return;
    }

    if (title.trim().length < 3) {
      setMessage("Video title must be at least 3 characters long.");
      return;
    }

    if (thumbnail) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      if (!allowedTypes.includes(thumbnail.type)) {
        setMessage("Only JPG, PNG and WEBP thumbnails are allowed.");
        return;
      }

      const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024;

      if (thumbnail.size > MAX_THUMBNAIL_SIZE) {
        setMessage("Thumbnail size 2 MB se kam honi chahiye.");
        return;
      }
    }

    const formData = new FormData();

    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("category", category);
    formData.append("visibility", visibility);
    formData.append("video_file", selectedFile);

    if (thumbnail) {
      formData.append("thumbnail", thumbnail);
    }

    setLoading(true);

    try {
      const response = await axiosClient.post(
        API_ENDPOINTS.VIDEOS.UPLOAD,
        formData
      );

      console.log("Video uploaded successfully:", response.data);

      alert("Video uploaded successfully!");

      resetForm();
      onClose();
    } catch (error) {
      console.error("Video upload error:", error.response?.data || error);

      const data = error.response?.data;

      if (data) {
        const errorMessage =
          data.detail ||
          Object.values(data)
            .flat()
            .find((item) => typeof item === "string");

        setMessage(
          errorMessage || "Video upload failed. Please try again."
        );
      } else {
        setMessage(
          "Backend connection failed. Please check your internet or server."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="upload-modal-overlay" onClick={handleClose}>
      <section
        className="upload-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="upload-modal-header">
          <h2 id="upload-modal-title">Upload videos</h2>

          <button
            type="button"
            className="icon-button"
            aria-label="Close upload dialog"
            onClick={handleClose}
            disabled={loading}
          >
            <X size={22} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <label className="upload-dropzone">
            <UploadCloud size={48} />

            <strong>
              {selectedFile
                ? selectedFile.name
                : "Select video to upload"}
            </strong>

            <span>Choose a video file from your computer</span>

            <input
              type="file"
              accept="video/*"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              disabled={loading}
            />
          </label>

          <label className="upload-field">
            <span>Title *</span>

            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add a title for your video"
              maxLength={200}
              required
              disabled={loading}
            />
          </label>

          <label className="upload-field">
            <span>Description</span>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tell viewers about your video"
              rows={4}
              maxLength={5000}
              disabled={loading}
            />
          </label>

          <label className="upload-field">
            <span>Category *</span>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
              disabled={loading}
            >
              <option value="Education">Education</option>
              <option value="Gaming">Gaming</option>
              <option value="Music">Music</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Technology">Technology</option>
              <option value="Sports">Sports</option>
              <option value="Travel">Travel</option>
              <option value="News">News</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label className="upload-field">
            <span>Visibility *</span>

            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
              required
              disabled={loading}
            >
              <option value="public">
                Public — Everyone can watch
              </option>
              <option value="private">
                Private — Only you can watch
              </option>
              <option value="unlisted">
                Unlisted — Anyone with the link
              </option>
            </select>
          </label>

          <label className="upload-field">
            <span>Custom Thumbnail</span>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setThumbnail(event.target.files?.[0] ?? null)
              }
              disabled={loading}
            />
          </label>

          {thumbnail && (
            <div className="thumbnail-preview">
              <button
                type="button"
                className="upload-cancel-button"
                onClick={() => setThumbnail(null)}
                disabled={loading}
              >
                Remove thumbnail
              </button>

              <img
                src={thumbnailPreview}
                alt="Selected thumbnail preview"
                style={{
                  width: "200px",
                  maxHeight: "120px",
                  objectFit: "cover",
                  borderRadius: "8px",
                }}
              />

              <p>{thumbnail.name}</p>
            </div>
          )}

          {selectedFile && (
            <p className="selected-file-info">
              <FileVideo size={18} />
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          )}

          {selectedFile && (
            <button
              type="button"
              className="upload-cancel-button"
              onClick={() => setSelectedFile(null)}
              disabled={loading}
            >
              Remove selected video
            </button>
          )}

          {videoPreview && (
            <div className="video-preview-container">
              <video
                src={videoPreview}
                controls
                width="100%"
                style={{
                  maxHeight: "240px",
                  borderRadius: "12px",
                  background: "#000",
                }}
              />

              <p>Video preview</p>
            </div>
          )}

          {message && (
            <p className="auth-message" role="alert">
              {message}
            </p>
          )}

          <footer className="upload-modal-footer">
            <button
              type="button"
              className="upload-cancel-button"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="upload-submit-button"
              disabled={loading}
            >
              {loading ? "Uploading..." : "Upload video"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
