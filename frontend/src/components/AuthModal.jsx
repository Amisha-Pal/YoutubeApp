
import { useState } from "react";
import { X, Play, Eye, EyeOff, ArrowLeft } from "lucide-react";
import axiosClient from "../api/axiosClient";
import API_ENDPOINTS from "../api/endpoints";

export default function AuthModal({ isOpen, onClose }) {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setMessage("");
    setShowPassword(false);
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    resetForm();
  }

  function handleClose() {
    resetForm();
    setMode("login");
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (mode === "register" && !name.trim()) {
      setMessage("Please enter your username.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const response = await axiosClient.post(
          API_ENDPOINTS.AUTH.REGISTER,
          {
            username: name.trim(),
            email: email.trim().toLowerCase(),
            password,
          }
        );

        setMessage(
          response.data.message || "Account created successfully."
        );

        setMode("login");
        setEmail("");
        setPassword("");
        setName("");
      } else if (mode === "login") {
        const response = await axiosClient.post(
          API_ENDPOINTS.AUTH.LOGIN,
          {
            username: email.trim(),
            password,
          }
        );

        localStorage.setItem("accessToken", response.data.access);
        localStorage.setItem("refreshToken", response.data.refresh);

        handleClose();
        window.location.reload();
      } else {
        setMessage("Password reset is not configured yet.");
      }
    } catch (error) {
      const data = error.response?.data;

      if (data) {
        const errorMessage =
          data.detail ||
          Object.values(data).flat().find(
            (item) => typeof item === "string"
          );

        setMessage(
          errorMessage || "Something went wrong. Please try again."
        );
      } else {
        setMessage("Backend connection failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={handleClose}>
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="auth-modal-header">
          {mode !== "login" ? (
            <button
              type="button"
              className="icon-button"
              aria-label="Back to login"
              onClick={() => changeMode("login")}
            >
              <ArrowLeft size={22} />
            </button>
          ) : (
            <span className="auth-logo">
              <Play size={20} fill="white" />
            </span>
          )}

          <button
            type="button"
            className="icon-button"
            aria-label="Close authentication dialog"
            onClick={handleClose}
          >
            <X size={22} />
          </button>
        </header>

        <div className="auth-modal-content">
          <h2 id="auth-modal-title">
            {mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create your account"
                : "Forgot password?"}
          </h2>

          <p className="auth-subtitle">
            {mode === "login"
              ? "Continue to YouTube"
              : mode === "register"
                ? "Create an account to get started"
                : "Enter your email to continue"}
          </p>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <label className="auth-field">
                <span>Username</span>

                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Choose a username"
                  autoComplete="username"
                  required
                />
              </label>
            )}

            <label className="auth-field">
              <span>
                {mode === "login" ? "Username" : "Email address"}
              </span>

              <input
                type={mode === "login" ? "text" : "email"}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={
                  mode === "login"
                    ? "Enter your username"
                    : "Enter your email"
                }
                autoComplete={
                  mode === "login" ? "username" : "email"
                }
                required
              />
            </label>

            {mode !== "forgot" && (
              <label className="auth-field">
                <span>Password</span>

                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete={
                      mode === "login"
                        ? "current-password"
                        : "new-password"
                    }
                    minLength={8}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </label>
            )}

            {mode === "login" && (
              <button
                type="button"
                className="forgot-password-button"
                onClick={() => changeMode("forgot")}
              >
                Forgot password?
              </button>
            )}

            {message && (
              <p className="auth-message" role="status">
                {message}
              </p>
            )}

            <button
              type="submit"
              className="auth-submit-button"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : mode === "register"
                    ? "Create account"
                    : "Continue"}
            </button>
          </form>

          {mode !== "forgot" && (
            <p className="auth-switch">
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}

              <button
                type="button"
                onClick={() =>
                  changeMode(
                    mode === "login" ? "register" : "login"
                  )
                }
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              className="auth-back-button"
              onClick={() => changeMode("login")}
            >
              Back to sign in
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
