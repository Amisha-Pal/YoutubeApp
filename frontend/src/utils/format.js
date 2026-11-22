export const FALLBACK_THUMBNAIL =
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=640&h=360&fit=crop";

export function avatarFor(name) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
    name || "User"
  )}`;
}

export function formatViews(count) {
  const value = Number(count) || 0;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(remainingSeconds)}`
    : `${pad(minutes)}:${pad(remainingSeconds)}`;
}

export function formatUploadedDate(date) {
  const days = Math.floor((Date.now() - new Date(date)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// Converts an API video into the shape used by VideoCard and saved lists.
export function formatVideo(video) {
  return {
    id: video.id,
    ownerId: video.owner,
    title: video.title,
    channel: video.owner_username,
    views: formatViews(video.views_count),
    uploaded: formatUploadedDate(video.created_at),
    duration: formatDuration(video.duration),
    category: video.category,
    visibility: video.visibility,
    status: video.status,
    thumbnail: video.thumbnail || FALLBACK_THUMBNAIL,
    videoUrl: video.video_file,
    avatar: avatarFor(video.owner_username),
    description: video.description,
  };
}
