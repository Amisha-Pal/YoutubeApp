import { useState } from "react";
import { Info } from "lucide-react";

import Dialog from "./Dialog";

const REPORT_REASONS = [
  "Sexual content",
  "Violent or repulsive content",
  "Hateful or abusive content",
  "Harassment or bullying",
  "Harmful or dangerous acts",
  "Misinformation",
  "Child abuse",
  "Promotes terrorism",
  "Spam or misleading",
  "Legal issue",
];

export default function ReportDialog({ video, onClose }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!reason) return;
    // There is no reporting API on the backend yet, so nothing is sent.
    setSubmitted(true);
  };

  return (
    <Dialog title="Report video" onClose={onClose} className="report-dialog">
      <form onSubmit={handleSubmit}>
        <p className="report-video-title">{video.title}</p>

        <fieldset className="report-reasons" disabled={submitted}>
          <legend>What's going on?</legend>
          {REPORT_REASONS.map((item) => (
            <label key={item} className="report-reason">
              <input
                type="radio"
                name="report-reason"
                value={item}
                checked={reason === item}
                onChange={() => setReason(item)}
              />
              <span>{item}</span>
            </label>
          ))}
        </fieldset>

        <label className="watch-dialog-label" htmlFor="report-details">
          Additional details (optional)
        </label>
        <textarea
          id="report-details"
          className="watch-dialog-textarea"
          rows={3}
          maxLength={500}
          value={details}
          disabled={submitted}
          onChange={(event) => setDetails(event.target.value)}
        />

        {submitted && (
          <p className="watch-dialog-notice warning" role="alert">
            <Info size={18} />
            Your report was not sent: reporting isn't supported by the server yet.
          </p>
        )}

        <div className="watch-dialog-actions">
          <button type="button" className="watch-dialog-secondary" onClick={onClose}>
            {submitted ? "Close" : "Cancel"}
          </button>
          <button
            type="submit"
            className="watch-dialog-primary"
            disabled={!reason || submitted}
          >
            Report
          </button>
        </div>
      </form>
    </Dialog>
  );
}
