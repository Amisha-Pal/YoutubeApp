import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Home from "./pages/Home";
import Watch from "./pages/Watch";
import WatchLater from "./pages/WatchLater";
import History from "./pages/History";
import You from "./pages/You";
import Subscriptions from "./pages/Subscriptions";
import Channel from "./pages/Channel";
import Playlists from "./pages/Playlists";
import PlaylistDetails from "./pages/PlaylistDetails";
import SearchResults from "./pages/SearchResults";
import YourVideos from "./pages/YourVideos";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import ResetPassword from "./pages/ResetPassword";
import { CategoryFeed, LikedVideos, Shorts, Trending } from "./pages/FeedPages";
import { WatchLaterProvider } from "./context/WatchLaterContext";
import { HistoryProvider } from "./context/HistoryContext";
import "./App.css";
import "./index.css";

// Remount per-id pages so state from the previous video/playlist never leaks.
function WatchRoute() {
  const { id } = useParams();
  return <Watch key={id} />;
}

function PlaylistRoute() {
  const { playlistId } = useParams();
  return <PlaylistDetails key={playlistId} />;
}

function App() {
  return (
    <HistoryProvider>
      <WatchLaterProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watch/:id" element={<WatchRoute />} />
            <Route path="/watch-later" element={<WatchLater />} />
            <Route path="/history" element={<History />} />
            <Route path="/you" element={<You />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/channel/:channelId" element={<Channel />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/playlists/:playlistId" element={<PlaylistRoute />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/your-videos" element={<YourVideos />} />
            <Route path="/liked-videos" element={<LikedVideos />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/shorts" element={<Shorts />} />
            <Route path="/music" element={<CategoryFeed key="Music" category="Music" />} />
            <Route path="/gaming" element={<CategoryFeed key="Gaming" category="Gaming" />} />
            <Route path="/sports" element={<CategoryFeed key="Sports" category="Sports" />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
            <Route path="/feedback" element={<Help />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </WatchLaterProvider>
    </HistoryProvider>
  );
}

export default App;
