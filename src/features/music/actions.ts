"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { uploadFileToMongo, deleteFileFromMongo } from "@/lib/mongo-storage";
import { searchSpotify } from "@/lib/music/spotify";
import { getErrorMessage } from "@/lib/utils";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME = new Set(["audio/mpeg", "audio/mp3", "audio/mp4", "video/mp4", "audio/x-m4a", "audio/wav", "audio/ogg"]);
const VALID_MODES = ["DEFAULT", "FOCUS", "CHILL", "HYPE", "SLEEP"];

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function searchSpotifyTracks(query: string) {
  try {
    await getUserId(); // require login, but Spotify search itself is app-only auth
    const results = await searchSpotify(query);
    return { success: true, data: results };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Search failed"), data: [] };
  }
}

export async function getTracks(mode?: string) {
  try {
    const userId = await getUserId();
    const tracks = await prisma.track.findMany({
      where: { userId, ...(mode ? { mode } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        artist: true,
        mimeType: true,
        duration: true,
        source: true,
        mode: true,
        createdAt: true,
        // mongoIndex/fileId intentionally excluded from the client payload;
        // playback goes through /api/music/stream/[trackId] instead.
      },
    });
    return { success: true, data: tracks };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to load tracks"), data: [] };
  }
}

export async function uploadTrack(formData: FormData) {
  try {
    const userId = await getUserId();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, message: "No file was provided." };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { success: false, message: `File is too large (max ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)}MB).` };
    }
    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(mimeType)) {
      return { success: false, message: "Only mp3, mp4, m4a, wav, or ogg audio files are supported." };
    }

    const mode = (formData.get("mode") as string | null) || "DEFAULT";
    if (!VALID_MODES.includes(mode)) {
      return { success: false, message: "Invalid mode." };
    }
    const title = (formData.get("title") as string | null)?.trim() || file.name.replace(/\.[^.]+$/, "");
    const artist = (formData.get("artist") as string | null)?.trim() || undefined;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { mongoIndex, fileId } = await uploadFileToMongo(buffer, file.name, mimeType, { userId });

    const track = await prisma.track.create({
      data: {
        userId,
        title,
        artist,
        mongoIndex,
        fileId,
        mimeType,
        fileSize: file.size,
        source: "UPLOAD",
        mode,
      },
    });

    revalidatePath("/");
    return { success: true, data: { id: track.id } };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to upload track.") };
  }
}

export async function deleteTrack(id: string) {
  try {
    const userId = await getUserId();
    const track = await prisma.track.findUnique({ where: { id } });
    if (!track || track.userId !== userId) {
      return { success: false, message: "Track not found." };
    }

    if (track.source === "UPLOAD" && track.mongoIndex != null && track.fileId) {
      await deleteFileFromMongo(track.mongoIndex, track.fileId).catch(() => {
        // If the underlying blob is already gone, still remove the DB row
        // rather than leaving an orphaned record the user can't delete.
      });
    }

    await prisma.track.delete({ where: { id } });
    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to delete track.") };
  }
}

export async function getPlayerState() {
  try {
    const userId = await getUserId();
    const state = await prisma.playerState.findUnique({ where: { userId } });
    return { success: true, data: state };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error), data: null };
  }
}

export async function savePlayerState(input: {
  trackId?: string | null;
  positionMs?: number;
  volume?: number;
  mode?: string;
  isPlaying?: boolean;
}) {
  try {
    const userId = await getUserId();

    // If a trackId is provided, verify it actually belongs to this user
    // before persisting it — prevents a crafted request from wiring a
    // stranger's track id into your player state.
    if (input.trackId) {
      const track = await prisma.track.findUnique({ where: { id: input.trackId } });
      if (!track || track.userId !== userId) {
        return { success: false, message: "Invalid track." };
      }
    }

    const volume = input.volume != null ? Math.min(100, Math.max(0, Math.round(input.volume))) : undefined;

    await prisma.playerState.upsert({
      where: { userId },
      create: {
        userId,
        trackId: input.trackId ?? undefined,
        positionMs: input.positionMs ?? 0,
        volume: volume ?? 80,
        mode: input.mode ?? "DEFAULT",
        isPlaying: input.isPlaying ?? false,
      },
      update: {
        ...(input.trackId !== undefined ? { trackId: input.trackId } : {}),
        ...(input.positionMs !== undefined ? { positionMs: input.positionMs } : {}),
        ...(volume !== undefined ? { volume } : {}),
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.isPlaying !== undefined ? { isPlaying: input.isPlaying } : {}),
      },
    });

    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to save player state.") };
  }
}
