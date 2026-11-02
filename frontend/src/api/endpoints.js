
const API_ENDPOINTS = {
  AUTH: {
    REGISTER: "accounts/register/",
    LOGIN: "accounts/login/",
    REFRESH: "accounts/token/refresh/",
  },

  VIDEOS: {
    LIST: "videos/",
    DETAIL: (videoId) => `videos/${videoId}/`,
    UPLOAD: "videos/",
  },
};

export default API_ENDPOINTS;
