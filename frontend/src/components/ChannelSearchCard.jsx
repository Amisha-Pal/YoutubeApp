import { useNavigate } from "react-router-dom";

export default function ChannelSearchCard({ channel }) {
    const navigate = useNavigate();
    const customization = channel.channel_customization || {};
    const profilePicture = customization.profile_picture;

    return (
        <div
            className="channel-search-card"
            onClick={() => navigate(`/channel/${channel.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    navigate(`/channel/${channel.id}`);
                }
            }}
        >
            <div className="channel-search-avatar">
                {profilePicture ? (
                    <img src={profilePicture} alt={channel.username} />
                ) : (
                    <div className="channel-avatar-fallback">
                        {channel.username.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>

            <div className="channel-search-info">
                <h3>{channel.username}</h3>

                <p>
                    {channel.subscribers_count} subscribers
                    {" • "}
                    {channel.videos_count} videos
                </p>

                {customization.description && (
                    <p className="channel-search-description">
                        {customization.description}
                    </p>
                )}
            </div>

            <button
                className="channel-visit-btn"
                onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/channel/${channel.id}`);
                }}
            >
                View Channel
            </button>
        </div>
    );
}