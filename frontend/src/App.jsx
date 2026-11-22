
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

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

import { WatchLaterProvider } from "./context/WatchLaterContext";
import { HistoryProvider } from "./context/HistoryContext";

import "./App.css";
import "./index.css";

function App() {
  return (
    <HistoryProvider>
      <WatchLaterProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watch/:id" element={<Watch />} />
            <Route path="/watch-later" element={<WatchLater />} />
            <Route path="/history" element={<History />} />
            <Route path="/you" element={<You />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/channel/:channelId" element={<Channel />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/playlists/:playlistId" element={<PlaylistDetails />} />
            <Route path="/search" element={<SearchResults />} />
          </Routes>
        </BrowserRouter>
      </WatchLaterProvider>
    </HistoryProvider>
  );
}

export default App;

