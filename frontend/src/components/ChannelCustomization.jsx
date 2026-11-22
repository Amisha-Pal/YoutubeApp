import { useEffect, useState } from "react";
import { X, Upload } from "lucide-react";
import axiosClient from "../api/axiosClient";

export default function ChannelCustomization({ onClose, onSaved }) {
  const [description, setDescription] = useState("");
  const [profilePicture, setProfilePicture] = useState(null);
  const [banner, setBanner] = useState(null);

  const [profilePreview, setProfilePreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await axiosClient.get(
          "accounts/channel-profile/"
        );

        setDescription(response.data.description || "");
        setProfilePreview(response.data.profile_picture || "");
        setBannerPreview(response.data.banner || "");
      } catch (err) {
        console.error("Profile loading failed:", err);
        setError("Channel details load nahi ho paye.");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  function handleProfileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setProfilePicture(file);
    setProfilePreview(URL.createObjectURL(file));
  }

  function handleBannerChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBanner(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  async function handleSave(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const formData = new FormData();

      formData.append("description", description);

      if (profilePicture) {
        formData.append("profile_picture", profilePicture);
      }

      if (banner) {
        formData.append("banner", banner);
      }

      await axiosClient.patch(
        "accounts/channel-profile/",
        formData
      );

      onSaved();
      onClose();
    } catch (err) {
      console.error("Profile update failed:", err);
      setError(
        err.response?.data?.detail ||
        "Channel update nahi ho paya. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="channel-modal-overlay">
      <div className="channel-customization-modal">
        <div className="channel-modal-header">
          <h2>Customize Channel</h2>

          <button type="button" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        {loading ? (
          <p>Loading channel details...</p>
        ) : (
          <form onSubmit={handleSave}>
            <div className="channel-form-group">
              <label>Channel Banner</label>

              {bannerPreview && (
                <img
                  src={bannerPreview}
                  alt="Channel banner preview"
                  className="channel-banner-preview"
                />
              )}

              <label className="channel-upload-button">
                <Upload size={17} />
                Upload Banner

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={handleBannerChange}
                />
              </label>
            </div>

            <div className="channel-form-group">
              <label>Profile Picture</label>

              {profilePreview && (
                <img
                  src={profilePreview}
                  alt="Profile preview"
                  className="channel-profile-preview"
                />
              )}

              <label className="channel-upload-button">
                <Upload size={17} />
                Upload Picture

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={handleProfileChange}
                />
              </label>
            </div>

            <div className="channel-form-group">
              <label htmlFor="channel-description">
                Channel Description
              </label>

              <textarea
                id="channel-description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                maxLength={1000}
                rows={5}
                placeholder="Tell viewers about your channel..."
              />

              <small>{description.length}/1000 characters</small>
            </div>

            {error && (
              <p className="channel-error">{error}</p>
            )}

            <div className="channel-modal-actions">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>

              <button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}