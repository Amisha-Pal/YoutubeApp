const API_ENDPOINTS = {
  AUTH: {
    REGISTER: "accounts/register/",
    LOGIN: "accounts/login/",
    REFRESH: "accounts/token/refresh/",
    LOGOUT: "accounts/logout/",
    PROFILE: "accounts/profile/",
    PASSWORD_RESET: "accounts/password-reset/",
    PASSWORD_RESET_CONFIRM: "accounts/password-reset/confirm/",
  },

  VIDEOS: {
    LIST: "videos/",
    DETAIL: (videoId) => `videos/${videoId}/`,
    UPLOAD: "videos/",
  },

  PLAYLISTS: {
    LIST: "videos/playlists/",
    DETAIL: (playlistId) => `videos/playlists/${playlistId}/`,
    ADD_VIDEO: (playlistId) => `videos/playlists/${playlistId}/videos/`,
    REMOVE_VIDEO: (playlistId, videoId) =>
      `videos/playlists/${playlistId}/videos/${videoId}/`,
    REORDER: (playlistId) =>
      `videos/playlists/${playlistId}/reorder/`,
  },
};

export default API_ENDPOINTS;