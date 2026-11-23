import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import PageLayout from "../components/PageLayout";
import axiosClient from "../api/axiosClient";
import API_ENDPOINTS from "../api/endpoints";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      setSubmitting(true);
      const response = await axiosClient.post(
        API_ENDPOINTS.AUTH.PASSWORD_RESET_CONFIRM,
        { uid, token, new_password: password }
      );
      setMessage(response.data.message);
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.detail ||
          data?.new_password?.join(" ") ||
          "Password could not be reset."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout>
      <section className="feed-page settings-page">
        <header className="feed-header">
          <KeyRound size={28} />
          <h1>Reset password</h1>
        </header>
        <div className="settings-card">
          {!uid || !token ? (
            <p>This reset link is incomplete. Request a new one from Sign in → Forgot password.</p>
          ) : message ? (
            <>
              <p role="status">{message}</p>
              <Link to="/">Go to home and sign in</Link>
            </>
          ) : (
            <form className="your-video-edit" onSubmit={handleSubmit}>
              <label>
                New password
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
              </label>
              <label>
                Confirm new password
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
              </label>
              {error && <p role="alert" className="form-error">{error}</p>}
              <div className="your-video-edit-actions">
                <button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Set new password"}</button>
              </div>
            </form>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
