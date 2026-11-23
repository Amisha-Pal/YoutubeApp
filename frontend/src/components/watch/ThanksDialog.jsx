import { useState } from "react";
import { HandHeart, Info } from "lucide-react";

import Dialog from "./Dialog";

const AMOUNTS = [20, 50, 100, 200, 500];

export default function ThanksDialog({ video, onClose }) {
  const [amount, setAmount] = useState(AMOUNTS[1]);
  const [message, setMessage] = useState("");

  return (
    <Dialog title="Thanks" onClose={onClose} className="thanks-dialog">
      <div className="thanks-hero">
        <HandHeart size={36} />
        <div>
          <strong>Show your support for {video.channel}</strong>
          <p>Buy a Super Thanks and highlight your comment on “{video.title}”.</p>
        </div>
      </div>

      <div className="thanks-amounts" role="radiogroup" aria-label="Thanks amount">
        {AMOUNTS.map((value) => (
          <button
            type="button"
            role="radio"
            aria-checked={amount === value}
            key={value}
            className={amount === value ? "selected" : ""}
            onClick={() => setAmount(value)}
          >
            ₹{value}
          </button>
        ))}
      </div>

      <label className="watch-dialog-label" htmlFor="thanks-message">
        Add a comment (optional)
      </label>
      <textarea
        id="thanks-message"
        className="watch-dialog-textarea"
        maxLength={250}
        rows={3}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Say thanks to the creator"
      />

      <p className="watch-dialog-notice" role="note">
        <Info size={18} />
        Payments aren't available yet, so Thanks can't be sent and you won't be charged.
      </p>

      <div className="watch-dialog-actions">
        <button type="button" className="watch-dialog-secondary" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="watch-dialog-primary"
          disabled
          aria-disabled="true"
          title="Payments aren't available yet"
        >
          Buy and send ₹{amount}
        </button>
      </div>
    </Dialog>
  );
}
