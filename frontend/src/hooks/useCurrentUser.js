import { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { AUTH_CHANGED_EVENT, isLoggedIn } from "../utils/auth";

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const handleAuthChange = () => setAuthVersion((value) => value + 1);
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isLoggedIn()) {
      Promise.resolve().then(() => !cancelled && setUser(null));
      return () => {
        cancelled = true;
      };
    }

    axiosClient
      .get("accounts/profile/")
      .then((response) => !cancelled && setUser(response.data))
      .catch(() => !cancelled && setUser(null));

    return () => {
      cancelled = true;
    };
  }, [authVersion]);

  return user;
}
