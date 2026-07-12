import { create } from "zustand";

export interface PlayerTrack {
  id: string;
  title: string;
  artist?: string | null;
  mimeType: string;
  duration?: number | null;
  mode: string;
  // "EXTERNAL" tracks come from Spotify search + the yt-dlp resolver, not
  // our own upload library — they stream via /api/music/external-stream
  // instead of /api/music/stream/[trackId], and don't persist playback
  // position (there's no matching DB row for savePlayerState to attach to).
  source?: "UPLOAD" | "EXTERNAL";
  albumArt?: string | null;
}

export type PlayerMode = "DEFAULT" | "FOCUS" | "CHILL" | "HYPE" | "SLEEP";

interface MusicPlayerState {
  isOpen: boolean;
  isMinimized: boolean;
  isPlaying: boolean;
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  volume: number; // 0-100
  mode: PlayerMode;
  progressMs: number;

  toggleOpen: () => void;
  setMinimized: (v: boolean) => void;
  setQueue: (tracks: PlayerTrack[]) => void;
  playTrack: (track: PlayerTrack) => void;
  togglePlay: () => void;
  setPlaying: (v: boolean) => void;
  next: () => void;
  previous: () => void;
  setVolume: (v: number) => void;
  setMode: (mode: PlayerMode) => void;
  setProgress: (ms: number) => void;
}

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  isOpen: false,
  isMinimized: true,
  isPlaying: false,
  currentTrack: null,
  queue: [],
  volume: 80,
  mode: "DEFAULT",
  progressMs: 0,

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setMinimized: (v) => set({ isMinimized: v }),
  setQueue: (tracks) => set({ queue: tracks }),

  playTrack: (track) =>
    set({
      currentTrack: track,
      isPlaying: true,
      progressMs: 0,
      isOpen: true,
    }),

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (v) => set({ isPlaying: v }),

  next: () => {
    const { queue, currentTrack } = get();
    if (!queue.length || !currentTrack) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const nextTrack = queue[(idx + 1) % queue.length];
    if (nextTrack) set({ currentTrack: nextTrack, isPlaying: true, progressMs: 0 });
  },

  previous: () => {
    const { queue, currentTrack } = get();
    if (!queue.length || !currentTrack) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const prevTrack = queue[(idx - 1 + queue.length) % queue.length];
    if (prevTrack) set({ currentTrack: prevTrack, isPlaying: true, progressMs: 0 });
  },

  setVolume: (v) => set({ volume: Math.min(100, Math.max(0, v)) }),
  setMode: (mode) => set({ mode }),
  setProgress: (ms) => set({ progressMs: ms }),
}));
