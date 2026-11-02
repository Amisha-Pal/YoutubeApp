
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const WatchLaterContext = createContext(null);

const STORAGE_KEY = "youtube-watch-later";

export function WatchLaterProvider({ children }) {
  const [watchLater, setWatchLater] = useState(() => {
    try {
      const savedVideos = localStorage.getItem(STORAGE_KEY);
      return savedVideos ? JSON.parse(savedVideos) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchLater));
  }, [watchLater]);

  function addToWatchLater(video) {
    setWatchLater((previous) => {
      const alreadyExists = previous.some(
        (item) => String(item.id) === String(video.id)
      );

      if (alreadyExists) {
        return previous;
      }

      return [...previous, video];
    });
  }

  function removeFromWatchLater(videoId) {
    setWatchLater((previous) =>
      previous.filter(
        (video) => String(video.id) !== String(videoId)
      )
    );
  }

  function isInWatchLater(videoId) {
    return watchLater.some(
      (video) => String(video.id) === String(videoId)
    );
  }

  return (
    <WatchLaterContext.Provider
      value={{
        watchLater,
        addToWatchLater,
        removeFromWatchLater,
        isInWatchLater,
      }}
    >
      {children}
    </WatchLaterContext.Provider>
  );
}

export function useWatchLater() {
  const context = useContext(WatchLaterContext);

  if (!context) {
    throw new Error(
      "useWatchLater must be used inside WatchLaterProvider"
    );
  }

  return context;
}

