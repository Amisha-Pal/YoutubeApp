
import { useState } from "react";
import {
  CircleUserRound,
  User,
  Settings,
  HelpCircle,
  MessageSquare,
  LogIn,
  X,
} from "lucide-react";
import AuthModal from "./AuthModal";

export default function ProfileMenu({ isOpen, onClose }) {
  const [authOpen, setAuthOpen] = useState(false);

  function handleSignIn() {
    onClose();
    setAuthOpen(true);
  }

  function handleAuthClose() {
    setAuthOpen(false);
  }

  return (
    <>
      {isOpen && (
        <>
          <div
            className="profile-menu-backdrop"
            onClick={onClose}
          />

          <div
            className="profile-menu"
            role="dialog"
            aria-label="Profile menu"
          >
            <div className="profile-menu-header">
              <CircleUserRound size={42} />

              <div>
                <strong>Guest User</strong>
                <p>Not signed in</p>
              </div>

              <button
                type="button"
                className="icon-button"
                aria-label="Close profile menu"
                onClick={onClose}
              >
                <X size={20} />
              </button>
            </div>

            <div className="profile-menu-divider" />

            <button
              type="button"
              className="profile-menu-item"
              onClick={handleSignIn}
            >
              <LogIn size={20} />
              <span>Sign in</span>
            </button>

            <button
              type="button"
              className="profile-menu-item"
              onClick={() =>
                alert("Your channel feature baad mein add karenge.")
              }
            >
              <User size={20} />
              <span>Your channel</span>
            </button>

            <button
              type="button"
              className="profile-menu-item"
              onClick={() =>
                alert("Settings feature baad mein add karenge.")
              }
            >
              <Settings size={20} />
              <span>Settings</span>
            </button>

            <div className="profile-menu-divider" />

            <button
              type="button"
              className="profile-menu-item"
              onClick={() => alert("Help feature baad mein add karenge.")}
            >
              <HelpCircle size={20} />
              <span>Help</span>
            </button>

            <button
              type="button"
              className="profile-menu-item"
              onClick={() => alert("Feedback feature baad mein add karenge.")}
            >
              <MessageSquare size={20} />
              <span>Send feedback</span>
            </button>
          </div>
        </>
      )}

      <AuthModal
        isOpen={authOpen}
        onClose={handleAuthClose}
      />
    </>
  );
}

