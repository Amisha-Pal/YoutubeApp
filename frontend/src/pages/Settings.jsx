import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import PageLayout from "../components/PageLayout";
import useCurrentUser from "../hooks/useCurrentUser";
import { useHistory } from "../context/HistoryContext";
import { logout } from "../utils/auth";

export default function Settings() {
  const user = useCurrentUser();
  const { clearHistory } = useHistory();
  const [autoplay, setAutoplay] = useState(
    () => localStorage.getItem("autoplayEnabled") !== "false"
  );
  const [message, setMessage] = useState("");

  function flash(text) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  }

  return (
    <PageLayout>
      <section className="feed-page settings-page">
        <header className="feed-header">
          <SettingsIcon size={28} />
          <h1>Settings</h1>
        </header>

        <div className="settings-card">
          <h2>Account</h2>
          {user ? (
            <>
              <p><strong>{user.username}</strong></p>
              <p>{user.email}</p>
              <button type="button" onClick={async () => { await logout(); window.location.assign("/"); }}>
                Sign out
              </button>
            </>
          ) : (
            <p>You are not signed in.</p>
          )}
        </div>

        <div className="settings-card">
          <h2>Playback</h2>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(event) => {
                setAutoplay(event.target.checked);
                localStorage.setItem("autoplayEnabled", String(event.target.checked));
              }}
            />
            Autoplay next video
          </label>
        </div>

        <div className="settings-card">
          <h2>Privacy</h2>
          <button type="button" onClick={() => { clearHistory(); flash("Watch history cleared."); }}>
            Clear watch history
          </button>
          <button type="button" onClick={() => { localStorage.removeItem("searchHistory"); flash("Search history cleared."); }}>
            Clear search history
          </button>
          <p className="settings-hint">Notification preferences are in the notifications panel (bell icon).</p>
        </div>

        {message && <p role="status" className="settings-message">{message}</p>}
      </section>
    </PageLayout>
  );
}
