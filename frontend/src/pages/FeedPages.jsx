import { Clapperboard, Flame, Gamepad2, Music2, ThumbsUp, Trophy } from "lucide-react";
import VideoFeedPage from "../components/VideoFeedPage";

export function Trending() {
  return (
    <VideoFeedPage
      title="Trending"
      icon={Flame}
      params={{ sort: "trending" }}
      emptyMessage="Popular videos from the last 30 days will appear here."
    />
  );
}

export function LikedVideos() {
  return (
    <VideoFeedPage
      title="Liked videos"
      icon={ThumbsUp}
      endpoint="videos/liked/"
      requiresAuth
      emptyTitle="No liked videos yet"
      emptyMessage="Videos you like will show up here."
    />
  );
}

export function Shorts() {
  return (
    <VideoFeedPage
      title="Shorts"
      icon={Clapperboard}
      params={{ duration: "short", sort: "latest" }}
      emptyMessage="Videos up to 60 seconds long will appear here."
    />
  );
}

const CATEGORY_ICONS = { Music: Music2, Gaming: Gamepad2, Sports: Trophy };

export function CategoryFeed({ category }) {
  return (
    <VideoFeedPage
      title={category}
      icon={CATEGORY_ICONS[category]}
      params={{ category, sort: "popular" }}
      emptyMessage={`No ${category.toLowerCase()} videos have been uploaded yet.`}
    />
  );
}
