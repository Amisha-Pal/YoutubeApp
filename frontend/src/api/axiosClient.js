import axios from "axios";
import { API_BASE_URL } from "./config";
import { clearTokens } from "../utils/auth";

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
  headers: {
    Accept: "application/json",
  },
});

// Request Interceptor
axiosClient.interceptors.request.use(
  (config) => {
    const url = config.url || "";
    const method = config.method?.toLowerCase();

    // Public video list aur view count ko token ki zarurat nahi.
    const isPublicVideoRequest =
      (url === "videos/" && method === "get") ||
      /^videos\/\d+\/view\/?$/.test(url);

    const isAuthRequest = [
      "accounts/register/",
      "accounts/login/",
      "accounts/token/refresh/",
    ].some((endpoint) => url.includes(endpoint));

    if (!isAuthRequest && !isPublicVideoRequest && !config._skipAuth) {
      const accessToken = localStorage.getItem("accessToken");

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Expired access token refresh
axiosClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes("accounts/token/refresh/") ||
      originalRequest.url?.includes("accounts/login/") ||
      originalRequest.url?.includes("accounts/register/")
    ) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const response = await axios.post(
        `${axiosClient.defaults.baseURL}accounts/token/refresh/`,
        {
          refresh: refreshToken,
        },
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      const newAccessToken = response.data.access;
      const newRefreshToken = response.data.refresh;
      localStorage.setItem("accessToken", newAccessToken);
      // JWT rotation enabled hai, isliye naya refresh token bhi save karo.
      if (newRefreshToken) {
        localStorage.setItem("refreshToken", newRefreshToken);
      }

      originalRequest.headers.Authorization =
        `Bearer ${newAccessToken}`;

      return axiosClient(originalRequest);

    } catch (refreshError) {
      clearTokens();

      // Session expired: retry once anonymously so public pages still load.
      if (originalRequest.headers?.Authorization) {
        delete originalRequest.headers.Authorization;
        originalRequest._skipAuth = true;
        return axiosClient(originalRequest).catch(() =>
          Promise.reject(refreshError)
        );
      }

      return Promise.reject(refreshError);
    }
  }
);

export default axiosClient;