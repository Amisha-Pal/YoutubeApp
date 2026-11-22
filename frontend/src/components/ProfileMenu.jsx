import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CircleUserRound,
  Clapperboard,
  User,
  Settings,
  HelpCircle,
  MessageSquare,
  LogIn,
  LogOut,
  X,
} from "lucide-react";
import AuthModal from "./AuthModal";
import useCurrentUser from "../hooks/useCurrentUser";
import { logout } from "../utils/auth";

export default function ProfileMenu({ isOpen, onClose }) {
  const [authOpen, setAuthOpen] = useState(false);
  const user = useCurrentUser();
  const navigate = useNavigate();

  function go(path) {
    onClose();
    navigate(path);
  }

  async function handleSignOut() {
    onClose();
    await logout();
    navigate("/");
  }

  return (
    <>
      {isOpen && (
        <>
          <div className="profile-menu-backdrop" onClick={onClose} />
          <div className="profile-menu" role="dialog" aria-label="Profile menu">
            <div className="profile-menu-header">
              <CircleUserRound size={42} />
              <div>
                <strong>{user ? user.username : "Guest User"}</strong>
                <p>{user ? user.email : "Not signed in"}</p>
              </div>
              <button type="button" className="icon-button" aria-label="Close profile menu" onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            <div className="profile-menu-divider" />

            {user ? (
              <>
                <button type="button" className="profile-menu-item" onClick={() => go(`/channel/${user.id}`)}>
                  <User size={20} />
                  <span>Your channel</span>
                </button>
                <button type="button" className="profile-menu-item" onClick={() => go("/your-videos")}>
                  <Clapperboard size={20} />
                  <span>Your videos</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="profile-menu-item"
                onClick={() => {
                  onClose();
                  setAuthOpen(true);
                }}
              >
                <LogIn size={20} />
                <span>Sign in</span>
              </button>
            )}

            <button type="button" className="profile-menu-item" onClick={() => go("/settings")}>
              <Settings size={20} />
              <span>Settings</span>
            </button>

            <div className="profile-menu-divider" />

            <button type="button" className="profile-menu-item" onClick={() => go("/help")}>
              <HelpCircle size={20} />
              <span>Help</span>
            </button>
            <button type="button" className="profile-menu-item" onClick={() => go("/feedback")}>
              <MessageSquare size={20} />
              <span>Send feedback</span>
            </button>

            {user && (
              <>
                <div className="profile-menu-divider" />
                <button type="button" className="profile-menu-item" onClick={handleSignOut}>
                  <LogOut size={20} />
                  <span>Sign out</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
