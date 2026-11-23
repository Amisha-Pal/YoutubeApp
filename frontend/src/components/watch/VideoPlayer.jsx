import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Subtitles,
  Settings,
  RectangleHorizontal,
  Maximize,
  Minimize,
  ChevronLeft,
  ChevronRight,
  Check,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

import { toAbsoluteMediaUrl } from "../../api/config";

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const QUALITY_ORDER = ["1080p", "720p", "480p", "360p"];
const HIDE_CONTROLS_DELAY = 2500;
const VOLUME_STEP = 0.05;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}`
    : `${minutes}:${secs}`;
}

function formatSpeed(speed) {
  return speed === 1 ? "Normal" : `${speed}x`;
}

function getCaptionTracks(videoElement) {
  if (!videoElement?.textTracks) return [];

  return Array.from(videoElement.textTracks).filter(
    (track) => track.kind === "subtitles" || track.kind === "captions"
  );
}

function isTypingTarget(target) {
  if (!target) return false;

  return (
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.isContentEditable
  );
}

/**
 * HTML5 video with YouTube-style auto-hiding controls.
 * `subtitles` takes real tracks only: [{ src, label, srclang }].
 */
export default function VideoPlayer({
  videoRef,
  src,
  qualities = {},
  subtitles = [],
  poster,
  title,
  autoPlay = false,
  autoplayEnabled,
  onToggleAutoplay,
  cinemaMode,
  onToggleCinemaMode,
  onEnded,
  onPlay,
}) {
  const containerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const lastVolumeRef = useRef(1);
  const revealOnlyTapRef = useRef(false);
  const pendingPlaybackRef = useRef(null);

  const [activeSrc, setActiveSrc] = useState(src);
  // Native autoplay applies to the first source only; quality switches
  // restore the previous play/pause state themselves.
  const [nativeAutoPlay, setNativeAutoPlay] = useState(autoPlay);
  const [selectedQuality, setSelectedQuality] = useState("Auto");
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [captionTracks, setCaptionTracks] = useState([]);
  const [activeCaption, setActiveCaption] = useState(-1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsPanel, setSettingsPanel] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");

  const availableQualities = QUALITY_ORDER.filter((quality) =>
    Boolean(qualities?.[quality])
  );
  const showControls = !playing || Boolean(settingsPanel) || controlsVisible;

  const showNotice = useCallback((message) => {
    setNotice(message);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 1800);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(
      () => setControlsVisible(false),
      HIDE_CONTROLS_DELAY
    );
  }, []);

  // Restore the viewer's last volume/mute so autoplayed videos keep it.
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const savedVolume = Number(localStorage.getItem("playerVolume"));
    if (localStorage.getItem("playerVolume") !== null && Number.isFinite(savedVolume)) {
      videoElement.volume = Math.min(1, Math.max(0, savedVolume));
      if (savedVolume > 0) lastVolumeRef.current = savedVolume;
    }
    videoElement.muted = localStorage.getItem("playerMuted") === "true";
  }, [videoRef]);

  useEffect(
    () => () => {
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(noticeTimerRef.current);
    },
    []
  );

  const togglePlay = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (videoElement.paused || videoElement.ended) {
      videoElement.play().catch(() => {});
    } else {
      videoElement.pause();
    }
  }, [videoRef]);

  const setPlayerVolume = useCallback(
    (nextVolume) => {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      const clamped = Math.min(1, Math.max(0, nextVolume));
      videoElement.volume = clamped;
      videoElement.muted = clamped === 0;

      if (clamped > 0) {
        lastVolumeRef.current = clamped;
      }
    },
    [videoRef]
  );

  const toggleMute = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (videoElement.muted || videoElement.volume === 0) {
      videoElement.volume = lastVolumeRef.current || 1;
      videoElement.muted = false;
    } else {
      lastVolumeRef.current = videoElement.volume;
      videoElement.muted = true;
    }
  }, [videoRef]);

  const seekBy = useCallback(
    (seconds) => {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      const maxTime = Number.isFinite(videoElement.duration)
        ? videoElement.duration
        : Infinity;

      videoElement.currentTime = Math.min(
        maxTime,
        Math.max(0, videoElement.currentTime + seconds)
      );
    },
    [videoRef]
  );

  const selectCaption = useCallback(
    (index) => {
      const tracks = getCaptionTracks(videoRef.current);

      tracks.forEach((track, trackIndex) => {
        track.mode = trackIndex === index ? "showing" : "disabled";
      });

      setActiveCaption(index);
    },
    [videoRef]
  );

  const toggleCaptions = useCallback(() => {
    const tracks = getCaptionTracks(videoRef.current);

    if (tracks.length === 0) {
      showNotice("Subtitles aren't available for this video");
      return;
    }

    const nextIndex = activeCaption >= 0 ? -1 : 0;
    selectCaption(nextIndex);
    showNotice(
      nextIndex >= 0
        ? `Subtitles: ${tracks[0].label || tracks[0].language || "On"}`
        : "Subtitles off"
    );
  }, [activeCaption, selectCaption, showNotice, videoRef]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const videoElement = videoRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => {
        showNotice("Fullscreen isn't available in this browser");
      });
    } else if (videoElement?.webkitEnterFullscreen) {
      // iOS Safari only supports native fullscreen on the video element.
      videoElement.webkitEnterFullscreen();
    }
  }, [showNotice, videoRef]);

  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setSettingsPanel(null);
  };

  const changeQuality = (quality) => {
    const videoElement = videoRef.current;
    const nextSrc = quality === "Auto" ? src : qualities?.[quality];

    setSettingsPanel(null);
    if (!videoElement || !nextSrc) return;

    const absoluteSrc = toAbsoluteMediaUrl(nextSrc);
    setSelectedQuality(quality);

    if (absoluteSrc === videoElement.currentSrc) return;

    pendingPlaybackRef.current = {
      currentTime: videoElement.currentTime,
      wasPlaying: !videoElement.paused,
    };
    setNativeAutoPlay(false);
    setActiveSrc(absoluteSrc);
  };

  const handleQualityOptionClick = (event) => {
    changeQuality(event.currentTarget.dataset.quality);
  };

  const handleCaptionOptionClick = (event) => {
    selectCaption(Number(event.currentTarget.dataset.index));
    setSettingsPanel(null);
  };

  const togglePictureInPicture = async () => {
    const videoElement = videoRef.current;
    setSettingsPanel(null);
    if (!videoElement) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoElement.requestPictureInPicture();
      }
    } catch {
      showNotice("Picture-in-picture isn't available right now");
    }
  };

  // Keyboard shortcuts: one capture-phase listener so native media key
  // handling never applies the same key twice.
  const shortcutsRef = useRef({});
  useEffect(() => {
    shortcutsRef.current = {
      togglePlay,
      toggleMute,
      toggleCaptions,
      toggleFullscreen,
      onToggleCinemaMode,
      seekBy,
      setPlayerVolume,
      revealControls,
      closeSettings: () => setSettingsPanel(null),
    };
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (
        event.target.closest?.("[role='dialog']") ||
        document.querySelector("[aria-modal='true']")
      ) {
        return;
      }

      const videoElement = videoRef.current;
      if (!videoElement) return;

      const actions = shortcutsRef.current;
      const insidePlayer = containerRef.current?.contains(event.target);
      const key = event.key.toLowerCase();

      // Let Space/Enter activate focused buttons outside the player.
      if (
        (key === " " || key === "enter") &&
        event.target.tagName === "BUTTON" &&
        !insidePlayer
      ) {
        return;
      }

      switch (key) {
        case " ":
        case "k":
          event.preventDefault();
          actions.togglePlay();
          break;
        case "m":
          event.preventDefault();
          actions.toggleMute();
          break;
        case "c":
          event.preventDefault();
          actions.toggleCaptions();
          break;
        case "t":
          event.preventDefault();
          actions.onToggleCinemaMode?.();
          break;
        case "f":
          event.preventDefault();
          actions.toggleFullscreen();
          break;
        case "arrowleft":
          event.preventDefault();
          actions.seekBy(-5);
          break;
        case "arrowright":
          event.preventDefault();
          actions.seekBy(5);
          break;
        case "arrowup":
          event.preventDefault();
          actions.setPlayerVolume(
            (videoElement.muted ? 0 : videoElement.volume) + VOLUME_STEP
          );
          break;
        case "arrowdown":
          event.preventDefault();
          actions.setPlayerVolume(
            (videoElement.muted ? 0 : videoElement.volume) - VOLUME_STEP
          );
          break;
        case "escape":
          actions.closeSettings();
          return;
        default:
          return;
      }

      actions.revealControls();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [videoRef]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Close the settings menu when clicking anywhere outside it.
  useEffect(() => {
    if (!settingsPanel) return undefined;

    const handlePointerDown = (event) => {
      if (!event.target.closest?.(".player-settings-menu, .player-settings-toggle")) {
        setSettingsPanel(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [settingsPanel]);

  const syncCaptionTracks = useCallback(() => {
    const tracks = getCaptionTracks(videoRef.current);
    setCaptionTracks(
      tracks.map((track, index) => ({
        index,
        label: track.label || track.language || `Track ${index + 1}`,
      }))
    );
    setActiveCaption(tracks.findIndex((track) => track.mode === "showing"));
  }, [videoRef]);

  useEffect(() => {
    const textTracks = videoRef.current?.textTracks;
    if (!textTracks?.addEventListener) return undefined;

    textTracks.addEventListener("addtrack", syncCaptionTracks);
    textTracks.addEventListener("removetrack", syncCaptionTracks);
    return () => {
      textTracks.removeEventListener("addtrack", syncCaptionTracks);
      textTracks.removeEventListener("removetrack", syncCaptionTracks);
    };
  }, [syncCaptionTracks, videoRef]);

  const handleLoadedMetadata = (event) => {
    const videoElement = event.currentTarget;
    setDuration(videoElement.duration || 0);
    videoElement.playbackRate = playbackSpeed;
    syncCaptionTracks();

    const pending = pendingPlaybackRef.current;
    if (!pending) return;

    pendingPlaybackRef.current = null;
    videoElement.currentTime = Math.min(
      pending.currentTime,
      Math.max(0, (videoElement.duration || 0) - 1)
    );
    if (pending.wasPlaying) {
      videoElement.play().catch(() => {});
    }
  };

  const handleProgress = (event) => {
    const { buffered, duration: total } = event.currentTarget;
    if (buffered.length > 0 && total) {
      setBufferedEnd(buffered.end(buffered.length - 1));
    }
  };

  const handleSeek = (event) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const nextTime = Number(event.target.value);
    videoElement.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const effectiveVolume = muted ? 0 : volume;
  const VolumeIcon =
    effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2;
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration ? (bufferedEnd / duration) * 100 : 0;
  const captionsOn = activeCaption >= 0;
  const captionLabel = captionsOn
    ? captionTracks[activeCaption]?.label
    : captionTracks.length > 0
      ? "Off"
      : "Unavailable";

  return (
    <div
      ref={containerRef}
      className={`yt-player ${showControls ? "controls-visible" : "controls-hidden"} ${
        isFullscreen ? "is-fullscreen" : ""
      }`}
      onMouseMove={revealControls}
      onMouseLeave={() => playing && !settingsPanel && setControlsVisible(false)}
      onTouchStart={revealControls}
      onFocus={revealControls}
    >
      <video
        ref={videoRef}
        className="yt-player-video"
        src={activeSrc}
        poster={poster}
        autoPlay={nativeAutoPlay}
        playsInline
        preload="metadata"
        aria-label={title ? `Video: ${title}` : "Video player"}
        onPointerDown={(event) => {
          revealOnlyTapRef.current =
            event.pointerType === "touch" && !showControls;
        }}
        onClick={() => {
          if (revealOnlyTapRef.current) {
            revealOnlyTapRef.current = false;
            revealControls();
            return;
          }
          togglePlay();
        }}
        onDoubleClick={toggleFullscreen}
        onPlay={(event) => {
          setPlaying(true);
          revealControls();
          onPlay?.(event);
        }}
        onPause={() => setPlaying(false)}
        onEnded={(event) => {
          setPlaying(false);
          onEnded?.(event);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onProgress={handleProgress}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setMuted(event.currentTarget.muted);
          localStorage.setItem("playerVolume", String(event.currentTarget.volume));
          localStorage.setItem("playerMuted", String(event.currentTarget.muted));
        }}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadStart={() => {
          setLoading(true);
          setError(false);
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onPlaying={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      >
        {subtitles.map((track) => (
          <track
            key={track.src}
            kind="subtitles"
            src={track.src}
            label={track.label}
            srcLang={track.srclang}
          />
        ))}
        Your browser does not support video playback.
      </video>

      {loading && !error && (
        <div className="yt-player-overlay" role="status" aria-label="Loading video">
          <LoaderCircle className="yt-player-spinner" size={48} />
        </div>
      )}

      {error && (
        <div className="yt-player-overlay yt-player-error" role="alert">
          <TriangleAlert size={36} />
          <p>This video couldn't be loaded. Check your connection and try again.</p>
        </div>
      )}

      {notice && (
        <div className="yt-player-notice" role="status">
          {notice}
        </div>
      )}

      {settingsPanel && (
        <div
          className="player-settings-menu"
          role="menu"
          aria-label="Player settings"
        >
          {settingsPanel === "main" && (
            <>
              <button
                type="button"
                role="menuitem"
                className="player-settings-item"
                onClick={() => setSettingsPanel("speed")}
              >
                <span>Playback speed</span>
                <span className="player-settings-value">
                  {formatSpeed(playbackSpeed)}
                  <ChevronRight size={18} />
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="player-settings-item"
                onClick={() => setSettingsPanel("quality")}
              >
                <span>Quality</span>
                <span className="player-settings-value">
                  {selectedQuality}
                  <ChevronRight size={18} />
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="player-settings-item"
                onClick={() => setSettingsPanel("subtitles")}
              >
                <span>Subtitles/CC</span>
                <span className="player-settings-value">
                  {captionLabel}
                  <ChevronRight size={18} />
                </span>
              </button>
              {document.pictureInPictureEnabled && (
                <button
                  type="button"
                  role="menuitem"
                  className="player-settings-item"
                  onClick={togglePictureInPicture}
                >
                  <span>Picture-in-picture</span>
                  <span className="player-settings-value">
                    {document.pictureInPictureElement ? "On" : "Off"}
                  </span>
                </button>
              )}
            </>
          )}

          {settingsPanel !== "main" && (
            <button
              type="button"
              className="player-settings-back"
              onClick={() => setSettingsPanel("main")}
            >
              <ChevronLeft size={18} />
              {settingsPanel === "speed"
                ? "Playback speed"
                : settingsPanel === "quality"
                  ? "Quality"
                  : "Subtitles/CC"}
            </button>
          )}

          {settingsPanel === "speed" &&
            PLAYBACK_SPEEDS.map((speed) => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={playbackSpeed === speed}
                key={speed}
                className="player-settings-option"
                onClick={() => changeSpeed(speed)}
              >
                <span className="player-settings-check">
                  {playbackSpeed === speed && <Check size={16} />}
                </span>
                {formatSpeed(speed)}
              </button>
            ))}

          {settingsPanel === "quality" &&
            [...availableQualities, "Auto"].map((quality) => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selectedQuality === quality}
                key={quality}
                className="player-settings-option"
                data-quality={quality}
                onClick={handleQualityOptionClick}
              >
                <span className="player-settings-check">
                  {selectedQuality === quality && <Check size={16} />}
                </span>
                {quality === "Auto" ? "Auto (original)" : quality}
              </button>
            ))}

          {settingsPanel === "quality" && availableQualities.length === 0 && (
            <p className="player-settings-note">
              Only the original quality is available for this video.
            </p>
          )}

          {settingsPanel === "subtitles" &&
            (captionTracks.length === 0 ? (
              <p className="player-settings-note">
                No subtitles are available for this video.
              </p>
            ) : (
              [{ index: -1, label: "Off" }, ...captionTracks].map((track) => (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeCaption === track.index}
                  key={track.index}
                  className="player-settings-option"
                  data-index={track.index}
                  onClick={handleCaptionOptionClick}
                >
                  <span className="player-settings-check">
                    {activeCaption === track.index && <Check size={16} />}
                  </span>
                  {track.label}
                </button>
              ))
            ))}
        </div>
      )}

      <div className="yt-player-controls">
        <input
          type="range"
          className="yt-player-progress"
          min={0}
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={handleSeek}
          aria-label="Seek"
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          style={{
            "--progress": `${progressPercent}%`,
            "--buffered": `${bufferedPercent}%`,
          }}
        />

        <div className="yt-player-bar">
          <div className="yt-player-left">
            <button
              type="button"
              className="player-control-btn"
              onClick={togglePlay}
              aria-label={playing ? "Pause (k)" : "Play (k)"}
              data-tooltip={playing ? "Pause (k)" : "Play (k)"}
            >
              {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>

            <div className="player-volume">
              <button
                type="button"
                className="player-control-btn"
                onClick={toggleMute}
                aria-label={effectiveVolume === 0 ? "Unmute (m)" : "Mute (m)"}
                data-tooltip={effectiveVolume === 0 ? "Unmute (m)" : "Mute (m)"}
              >
                <VolumeIcon size={24} />
              </button>
              <input
                type="range"
                className="player-volume-slider"
                min={0}
                max={1}
                step={VOLUME_STEP}
                value={effectiveVolume}
                onChange={(event) => setPlayerVolume(Number(event.target.value))}
                aria-label="Volume"
                aria-valuetext={`${Math.round(effectiveVolume * 100)}%`}
                style={{ "--volume": `${effectiveVolume * 100}%` }}
              />
            </div>

            <span className="player-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="yt-player-right">
            <button
              type="button"
              role="switch"
              className={`player-control-btn player-autoplay ${autoplayEnabled ? "on" : ""}`}
              onClick={onToggleAutoplay}
              aria-checked={autoplayEnabled}
              aria-label={`Autoplay is ${autoplayEnabled ? "on" : "off"}`}
              data-tooltip={`Autoplay is ${autoplayEnabled ? "on" : "off"}`}
            >
              <span className="player-autoplay-track">
                <span className="player-autoplay-knob">
                  {autoplayEnabled ? <Play size={10} fill="currentColor" /> : <Pause size={10} fill="currentColor" />}
                </span>
              </span>
            </button>

            <button
              type="button"
              className={`player-control-btn player-cc ${captionsOn ? "on" : ""} ${
                captionTracks.length === 0 ? "unavailable" : ""
              }`}
              onClick={toggleCaptions}
              aria-pressed={captionsOn}
              aria-label={
                captionTracks.length === 0
                  ? "Subtitles unavailable"
                  : `Subtitles/closed captions (c)`
              }
              data-tooltip={
                captionTracks.length === 0
                  ? "Subtitles unavailable"
                  : "Subtitles/closed captions (c)"
              }
            >
              <Subtitles size={24} />
            </button>

            <button
              type="button"
              className={`player-control-btn player-settings-toggle ${settingsPanel ? "open" : ""}`}
              onClick={() => setSettingsPanel((panel) => (panel ? null : "main"))}
              aria-haspopup="menu"
              aria-expanded={Boolean(settingsPanel)}
              aria-label="Settings"
              data-tooltip={settingsPanel ? "" : "Settings"}
            >
              <Settings size={24} />
            </button>

            <button
              type="button"
              className={`player-control-btn player-cinema ${cinemaMode ? "on" : ""}`}
              onClick={onToggleCinemaMode}
              aria-pressed={cinemaMode}
              aria-label={cinemaMode ? "Default view (t)" : "Cinema mode (t)"}
              data-tooltip={cinemaMode ? "Default view (t)" : "Cinema mode (t)"}
            >
              <RectangleHorizontal size={24} />
            </button>

            <button
              type="button"
              className="player-control-btn"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit full screen (f)" : "Full screen (f)"}
              data-tooltip={isFullscreen ? "Exit full screen (f)" : "Full screen (f)"}
            >
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
