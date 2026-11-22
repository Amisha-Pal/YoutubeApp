import { CircleHelp } from "lucide-react";
import PageLayout from "../components/PageLayout";

const SHORTCUTS = [
  ["Space / K", "Play or pause"],
  ["← / →", "Seek 5 seconds"],
  ["↑ / ↓", "Volume"],
  ["M", "Mute"],
  ["F", "Fullscreen"],
  ["T", "Theater mode"],
];

const FEEDBACK_EMAIL = import.meta.env.VITE_FEEDBACK_EMAIL;

export default function Help() {
  return (
    <PageLayout>
      <section className="feed-page settings-page">
        <header className="feed-header">
          <CircleHelp size={28} />
          <h1>Help &amp; feedback</h1>
        </header>

        <div className="settings-card">
          <h2>Keyboard shortcuts (watch page)</h2>
          <dl className="shortcut-list">
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys}><dt>{keys}</dt><dd>{action}</dd></div>
            ))}
          </dl>
        </div>

        <div className="settings-card">
          <h2>Uploading</h2>
          <p>Supported formats: MP4, MOV, WEBM, MKV up to 500 MB. Thumbnails: JPG, PNG, WEBP up to 5 MB.</p>
          <p>New uploads show as “processing” in Your videos until thumbnails and quality versions are ready.</p>
        </div>

        <div className="settings-card" id="feedback">
          <h2>Send feedback</h2>
          {FEEDBACK_EMAIL ? (
            <a href={`mailto:${FEEDBACK_EMAIL}?subject=YouTube%20Clone%20feedback`}>Email {FEEDBACK_EMAIL}</a>
          ) : (
            <p>Feedback email is not configured (set VITE_FEEDBACK_EMAIL).</p>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
