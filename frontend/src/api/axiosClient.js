
import axios from "axios";

const axiosClient = axios.create({
  baseURL: "http://127.0.0.1:8000/api/",
  timeout: 30000,
  headers: {
    Accept: "application/json",
  },
});

axiosClient.interceptors.request.use(
  (config) => {
    const isPublicVideoList =
      config.url === "videos/" &&
      config.method?.toLowerCase() === "get";

    const isAuthRequest = [
      "accounts/register/",
      "accounts/login/",
      "accounts/token/refresh/",
    ].some((endpoint) => config.url?.includes(endpoint));

    if (!isAuthRequest && !isPublicVideoList) {
      const accessToken = localStorage.getItem("accessToken");

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosClient;
