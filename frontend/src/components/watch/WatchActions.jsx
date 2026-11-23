import { useEffect, useRef, useState } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  BookmarkCheck,
  EllipsisVertical,
  Download,
  HandHeart,
  Flag,
  ListPlus,
} from "lucide-react";

import ThanksDialog from "./ThanksDialog";
import ReportDialog from "./ReportDialog";

function formatCount(count) {
  return count > 0 ? count.toLocaleString("en-IN") : "";
}

export default function WatchActions({
  video,
  userReaction,
  likesCount,
  dislikesCount,
  reactionLoading,
  onReact,
  onShare,
  saved,
  onToggleSave,
  onDownload,
  onSaveToPlaylist,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const runMenuAction = (action) => {
    setMenuOpen(false);
    action();
  };

  return (
    <div className="watch-actions" role="group" aria-label="Video actions">
      <div className="watch-like-group">
        <button
          type="button"
          className={`watch-action-btn watch-like-btn ${userReaction === "like" ? "active" : ""}`}
          onClick={() => onReact("like")}
          aria-pressed={userReaction === "like"}
          aria-label={`Like this video${likesCount > 0 ? `, ${likesCount} likes` : ""}`}
          title="I like this"
          disabled={reactionLoading}
        >
          <ThumbsUp size={20} fill={userReaction === "like" ? "currentColor" : "none"} />
          {formatCount(likesCount) && <span>{formatCount(likesCount)}</span>}
        </button>
        <span className="watch-like-divider" aria-hidden="true" />
        <button
          type="button"
          className={`watch-action-btn watch-dislike-btn ${userReaction === "dislike" ? "active" : ""}`}
          onClick={() => onReact("dislike")}
          aria-pressed={userReaction === "dislike"}
          aria-label={`Dislike this video${dislikesCount > 0 ? `, ${dislikesCount} dislikes` : ""}`}
          title="I dislike this"
          disabled={reactionLoading}
        >
          <ThumbsDown size={20} fill={userReaction === "dislike" ? "currentColor" : "none"} />
          {formatCount(dislikesCount) && <span>{formatCount(dislikesCount)}</span>}
        </button>
      </div>

      <button
        type="button"
        className="watch-action-btn"
        onClick={onShare}
        title="Share"
      >
        <Share2 size={20} />
        <span>Share</span>
      </button>

      <button
        type="button"
        className={`watch-action-btn ${saved ? "active" : ""}`}
        onClick={onToggleSave}
        aria-pressed={saved}
        title={saved ? "Remove from Watch Later" : "Save to Watch Later"}
      >
        {saved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
        <span>{saved ? "Saved" : "Save"}</span>
      </button>

      <div className="watch-more" ref={menuRef}>
        <button
          ref={menuButtonRef}
          type="button"
          className={`watch-action-btn watch-more-btn ${menuOpen ? "active" : ""}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More actions"
          title="More actions"
        >
          <EllipsisVertical size={20} />
        </button>

        {menuOpen && (
          <div className="watch-more-menu" role="menu" aria-label="More actions">
            <button type="button" role="menuitem" onClick={() => runMenuAction(onDownload)}>
              <Download size={20} />
              Download
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => runMenuAction(() => setDialog("thanks"))}
            >
              <HandHeart size={20} />
              Thanks
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => runMenuAction(() => setDialog("report"))}
            >
              <Flag size={20} />
              Report
            </button>
            <div className="watch-more-separator" role="separator" />
            <button type="button" role="menuitem" onClick={() => runMenuAction(onSaveToPlaylist)}>
              <ListPlus size={20} />
              Save to playlist
            </button>
          </div>
        )}
      </div>

      {dialog === "thanks" && (
        <ThanksDialog video={video} onClose={() => setDialog(null)} />
      )}
      {dialog === "report" && (
        <ReportDialog video={video} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
