import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Tv } from "lucide-react";
import VideoFeedPage from "../components/VideoFeedPage";
import axiosClient from "../api/axiosClient";
import { isLoggedIn } from "../utils/auth";
import { avatarFor } from "../utils/format";

function SubscribedChannels() {
  const [channels, setChannels] = useState([]);

  useEffect(() => {
    if (!isLoggedIn()) return undefined;
    let cancelled = false;
    axiosClient
      .get("videos/subscriptions/")
      .then((response) => !cancelled && setChannels(response.data))
      .catch(() => !cancelled && setChannels([]));
    return () => {
      cancelled = true;
    };
  }, []);

  if (channels.length === 0) return null;

  return (
    <div className="subscribed-channels" aria-label="Subscribed channels">
      {channels.map((channel) => (
        <Link key={channel.id} to={`/channel/${channel.id}`} className="subscribed-channel">
          <img
            src={channel.channel_customization?.profile_picture || avatarFor(channel.username)}
            alt=""
          />
          <span>{channel.username}</span>
        </Link>
      ))}
    </div>
  );
}

export default function Subscriptions() {
  return (
    <VideoFeedPage
      title="Subscriptions"
      icon={Tv}
      endpoint="videos/subscriptions/feed/"
      requiresAuth
      emptyTitle="No videos from your subscriptions"
      emptyMessage="Subscribe to channels to see their latest videos here."
    >
      <SubscribedChannels />
    </VideoFeedPage>
  );
}
