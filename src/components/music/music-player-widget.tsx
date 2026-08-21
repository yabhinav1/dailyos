"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music2,
  X,
  Upload,
  ListMusic,
  Loader2,
  Search,
} from "lucide-react";
import { useMusicPlayerStore, PlayerTrack, PlayerMode } from "@/stores/music-player-store";
import {
  getTracks,
  uploadTrack,
  savePlayerState,
  getPlayerState,
  searchSpotifyTracks,
} from "@/features/music/actions";

const MODES: { value: PlayerMode; label: string }[] = [
  { value: "DEFAULT", label: "All" },
  { value: "FOCUS", label: "Focus" },
  { value: "CHILL", label: "Chill" },
  { value: "HYPE", label: "Hype" },
  { value: "SLEEP", label: "Sleep" },
];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface SpotifyResult {
  spotifyId: string;
  title: string;
  artist: string;
  albumArt: string | null;
  durationMs: number;
}

export default function MusicPlayerWidget() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    isOpen,
    isMinimized,
    isPlaying,
    currentTrack,
    queue,
    volume,
    mode,
    toggleOpen,
    setQueue,
    playTrack,
    togglePlay,
    setPlaying,
    next,
    previous,
    setVolume,
    setMode,
  } = useMusicPlayerStore();

  const [loadingTracks, setLoadingTracks] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [restoredOnce, setRestoredOnce] = useState(false);
  const hasHydrated = useRef(false);

  // Spotify search (metadata only) — playback resolves via /api/music/external-stream
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<{
    query: string;
    items: SpotifyResult[];
    error: string | null;
  }>({ query: "", items: [], error: null });

  const trimmedQuery = searchQuery.trim();
  const resultsOpen = trimmedQuery.length > 0;

  // Results stay tied to the query that produced them, so clearing or
  // retyping the box hides the previous hits without a state reset — and
  // "still waiting" is just the box disagreeing with the last result.
  const settled = searchState.query === trimmedQuery;
  const searching = resultsOpen && !settled;
  const shown = settled ? searchState : { items: [] as SpotifyResult[], error: null };

  // Restore last playback state once, on first mount.
  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;
    (async () => {
      const res = await getPlayerState();
      if (res.success && res.data) {
        setVolume(res.data.volume);
        setMode((res.data.mode as PlayerMode) || "DEFAULT");
      }
      setRestoredOnce(true);
    })();
  }, [setVolume, setMode]);

  const [tracksToken, setTracksToken] = useState(0);
  const reloadTracks = useCallback(() => setTracksToken((n) => n + 1), []);

  useEffect(() => {
    if (!restoredOnce) return;
    let cancelled = false;
    (async () => {
      setLoadingTracks(true);
      const res = await getTracks(mode === "DEFAULT" ? undefined : mode);
      if (cancelled) return;
      if (res.success) {
        setQueue(res.data as PlayerTrack[]);
      }
      setLoadingTracks(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, restoredOnce, tracksToken, setQueue]);

  // Debounced Spotify search as the user types.
  useEffect(() => {
    if (!trimmedQuery) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await searchSpotifyTracks(trimmedQuery);
      if (cancelled) return;
      setSearchState({
        query: trimmedQuery,
        items: res.success ? (res.data as SpotifyResult[]) : [],
        error: res.success ? null : res.message || "Search failed.",
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  // Wire the <audio> element up to store state.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src =
      currentTrack.source === "EXTERNAL"
        ? `/api/music/external-stream?title=${encodeURIComponent(currentTrack.title)}&artist=${encodeURIComponent(currentTrack.artist || "")}`
        : `/api/music/stream/${currentTrack.id}`;
    audio.volume = volume / 100;
    if (isPlaying) audio.play().catch(() => setPlaying(false));
    // isPlaying/volume/setPlaying intentionally omitted: this effect should
    // only re-run when the TRACK changes (new src). Toggling play/pause for
    // the same track is handled by the effect below instead — including
    // isPlaying here would reload `audio.src` on every play/pause click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, currentTrack?.source]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [isPlaying, setPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume / 100;
  }, [volume]);

  // Debounced persistence of playback state so scrubbing/volume changes
  // don't spam the server action on every tick. External (Spotify-resolved)
  // tracks have no matching DB row, so position isn't persisted for those.
  const queueSaveState = useCallback((partial: Parameters<typeof savePlayerState>[0]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePlayerState(partial);
    }, 800);
  }, []);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (currentTrack && currentTrack.source !== "EXTERNAL") {
      queueSaveState({
        trackId: currentTrack.id,
        positionMs: Math.round(audio.currentTime * 1000),
        isPlaying,
      });
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) setDuration(audio.duration || 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    formData.append("title", file.name.replace(/\.[^.]+$/, ""));

    const res = await uploadTrack(formData);
    if (res.success) {
      reloadTracks();
    } else {
      setUploadError(res.message || "Upload failed.");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEnded = () => {
    if (currentTrack?.source !== "EXTERNAL") next();
  };

  const playSpotifyResult = (r: SpotifyResult) => {
    playTrack({
      id: `spotify:${r.spotifyId}`,
      title: r.title,
      artist: r.artist,
      mimeType: "audio/mpeg",
      duration: Math.round(r.durationMs / 1000),
      mode,
      source: "EXTERNAL",
      albumArt: r.albumArt,
    });
  };

  const isExternal = currentTrack?.source === "EXTERNAL";

  // ---- Collapsed pill (default, hovers over every page) ----
  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 hover:bg-emerald-500 active:scale-95"
        aria-label="Open music player"
      >
        {isPlaying ? (
          <span className="flex h-4 items-end gap-0.5">
            <span className="w-0.5 animate-[bounce_0.9s_ease-in-out_infinite] bg-white" style={{ height: "60%" }} />
            <span className="w-0.5 animate-[bounce_0.9s_ease-in-out_0.15s_infinite] bg-white" style={{ height: "100%" }} />
            <span className="w-0.5 animate-[bounce_0.9s_ease-in-out_0.3s_infinite] bg-white" style={{ height: "40%" }} />
          </span>
        ) : (
          <Music2 className="h-5 w-5" />
        )}
      </button>
    );
  }

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div
        className={`fixed bottom-5 right-5 z-40 overflow-hidden rounded-2xl border border-white/5 bg-[#121212]/95 shadow-2xl shadow-black/50 backdrop-blur-md transition-all duration-300 ease-out ${
          isMinimized ? "w-72" : "w-80"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <Music2 className="h-3 w-3 text-emerald-500" />
            Player
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowQueue((v) => !v)}
              className={`rounded p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200 ${showQueue ? "bg-white/5 text-emerald-400" : ""}`}
              aria-label="Toggle your library"
              title="Your library"
            >
              <ListMusic className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={toggleOpen}
              className="rounded p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              aria-label="Close player"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex gap-1 overflow-x-auto px-3 pt-2 pb-1 scrollbar-none">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                mode === m.value
                  ? "bg-emerald-600 text-white"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Spotify search */}
        <div className="px-3 pt-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
            {searching && (
              <Loader2 className="absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-zinc-400" />
            )}
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search a song to play..."
              className="h-7 w-full rounded-lg bg-white/5 pl-7 pr-7 text-xs text-zinc-200 placeholder-zinc-400 outline-none focus:bg-white/10"
            />
          </div>
        </div>

        {/* Search results — folds open/closed as you type/clear, animated */}
        <div
          className={`grid px-3 transition-all duration-300 ease-in-out ${
            resultsOpen ? "grid-rows-[1fr] opacity-100 pt-1.5" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="max-h-56 overflow-y-auto overflow-hidden rounded-xl bg-[#191919]">
            {shown.error ? (
              <p className="px-3 py-4 text-center text-xs text-red-400">{shown.error}</p>
            ) : shown.items.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-zinc-400">
                {searching ? "Searching…" : "No results yet."}
              </p>
            ) : (
              shown.items.map((r) => (
                <button
                  key={r.spotifyId}
                  onClick={() => playSpotifyResult(r)}
                  className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors first:rounded-t-xl last:rounded-b-xl ${
                    isExternal && currentTrack?.id === `spotify:${r.spotifyId}`
                      ? "bg-emerald-600/10"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-zinc-800">
                    {r.albumArt ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.albumArt} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Music2 className="h-full w-full p-1.5 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-200">{r.title}</p>
                    <p className="truncate text-[11px] text-zinc-400">{r.artist}</p>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
                    {formatTime(r.durationMs / 1000)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Now playing — compact Spotify-style card */}
        <div className="mx-3 mt-2 rounded-xl bg-[#191919] p-3">
          <div className="flex items-center gap-3">
            {/* Cover art with animated equalizer while playing */}
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-emerald-600/40 to-teal-900/40">
              {currentTrack?.albumArt && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentTrack.albumArt} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              {isPlaying && currentTrack ? (
                <div className={`relative flex h-4 items-end gap-[3px] ${currentTrack.albumArt ? "rounded bg-black/40 px-1 py-0.5" : ""}`}>
                  <span className="w-[3px] animate-[bounce_0.9s_ease-in-out_infinite] rounded-sm bg-emerald-400" style={{ height: "55%" }} />
                  <span className="w-[3px] animate-[bounce_0.9s_ease-in-out_0.15s_infinite] rounded-sm bg-emerald-400" style={{ height: "100%" }} />
                  <span className="w-[3px] animate-[bounce_0.9s_ease-in-out_0.3s_infinite] rounded-sm bg-emerald-400" style={{ height: "35%" }} />
                  <span className="w-[3px] animate-[bounce_0.9s_ease-in-out_0.45s_infinite] rounded-sm bg-emerald-400" style={{ height: "75%" }} />
                </div>
              ) : !currentTrack?.albumArt ? (
                <Music2 className="h-4.5 w-4.5 text-emerald-400/70" />
              ) : null}
            </div>

            {/* Title / artist */}
            <div className="min-w-0 flex-1">
              {currentTrack ? (
                <>
                  <p className="truncate text-xs font-semibold text-white">{currentTrack.title}</p>
                  <p className="truncate text-[11px] text-zinc-400">{currentTrack.artist || "Unknown artist"}</p>
                </>
              ) : (
                <p className="truncate text-xs text-zinc-400">
                  {loadingTracks ? "Loading tracks…" : "Search a song above, or open your library."}
                </p>
              )}
            </div>
          </div>

          {/* Scrubber */}
          <div className="mt-2.5 flex items-center gap-2">
            <span className="w-7 text-right text-[11px] tabular-nums text-zinc-400">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              disabled={!currentTrack}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            />
            <span className="w-7 text-[11px] tabular-nums text-zinc-400">{formatTime(duration)}</span>
          </div>

          {/* Controls — skip prev/next disabled for search results (no queue context) */}
          <div className="mt-2.5 flex items-center justify-center gap-5">
            <button onClick={previous} aria-label="Previous track" disabled={!currentTrack || isExternal} className="text-zinc-300 hover:text-white disabled:opacity-30">
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={() => (currentTrack ? togglePlay() : queue[0] && playTrack(queue[0]))}
              disabled={!currentTrack && queue.length === 0}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white transition-transform hover:scale-105 hover:bg-emerald-500 disabled:opacity-30"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
            </button>
            <button onClick={next} aria-label="Next track" disabled={!currentTrack || isExternal} className="text-zinc-300 hover:text-white disabled:opacity-30">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          {/* Volume */}
          <div className="mt-2.5 flex items-center gap-2">
            <button onClick={() => setVolume(volume === 0 ? 80 : 0)} className="text-zinc-400 hover:text-zinc-200">
              {volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                queueSaveState({ volume: v });
              }}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-emerald-500"
            />
          </div>
        </div>

        {/* Your uploaded library — folds open/closed the same way */}
        <div
          className={`grid mx-3 mt-2 transition-all duration-300 ease-in-out ${
            showQueue ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="max-h-48 overflow-y-auto overflow-hidden rounded-xl bg-[#191919]">
            {queue.length === 0 ? (
              <p className="px-4 py-4 text-center text-xs text-zinc-400">Nothing in this mode yet.</p>
            ) : (
              queue.map((t) => (
                <button
                  key={t.id}
                  onClick={() => playTrack(t)}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors first:rounded-t-xl last:rounded-b-xl ${
                    !isExternal && currentTrack?.id === t.id ? "bg-emerald-600/10 text-emerald-400" : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <Music2 className="h-3 w-3 shrink-0 opacity-60" />
                  <span className="truncate">{t.title}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Upload */}
        <div className="px-3 py-2.5">
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 py-2 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Uploading…" : "Upload MP3 / MP4"}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/mp4,video/mp4,audio/x-m4a,audio/wav,audio/ogg"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          {uploadError && <p className="mt-1.5 text-[11px] text-red-400">{uploadError}</p>}
        </div>
      </div>
    </>
  );
}
