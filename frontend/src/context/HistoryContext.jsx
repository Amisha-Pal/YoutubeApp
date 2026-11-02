import {
createContext,
useContext,
useEffect,
useState,
useCallback,
} from "react";

const HistoryContext = createContext(null);

const STORAGE_KEY = "youtube-watch-history";

export function HistoryProvider({ children }) {
const [history, setHistory] = useState(() => {
try {
const savedHistory = localStorage.getItem(STORAGE_KEY);
return savedHistory ? JSON.parse(savedHistory) : [];
} catch (error) {
console.error("Failed to load watch history:", error);
return [];
}
});

useEffect(() => {
try {
localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
} catch (error) {
console.error("Failed to save watch history:", error);
}
}, [history]);

const addToHistory = useCallback((video) => {
if (!video || video.id == null) return;


setHistory((previous) => {
  const filtered = previous.filter(
    (item) => String(item.id) !== String(video.id)
  );

  return [
    {
      ...video,
      watchedAt: new Date().toISOString(),
    },
    ...filtered,
  ];
});


}, []);

const removeFromHistory = useCallback((videoId) => {
setHistory((previous) =>
previous.filter(
(video) => String(video.id) !== String(videoId)
)
);
}, []);

const clearHistory = useCallback(() => {
setHistory([]);
}, []);

return (
<HistoryContext.Provider
value={{
history,
addToHistory,
removeFromHistory,
clearHistory,
}}
>
{children}
</HistoryContext.Provider>
);
}

export function useHistory() {
const context = useContext(HistoryContext);

if (!context) {
throw new Error(
"useHistory must be used inside HistoryProvider"
);
}

return context;
}
