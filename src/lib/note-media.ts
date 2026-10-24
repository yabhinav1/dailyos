import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFileFromMongo, uploadFileToMongo } from "@/lib/mongo-storage";

/**
 * Vercel refuses request bodies over 4.5MB before our code runs, so this is
 * the real ceiling. The editor scales large images down and stops voice
 * recordings well before it.
 */
export const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

// SVG is left out on purpose: it can carry script, and these files are
// served from our own origin.
const ALLOWED = /^(image\/(png|jpe?g|gif|webp|avif)|audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac))(;.*)?$/i;

export function isAllowedMediaType(mime: string) {
  return ALLOWED.test(mime);
}

/** Stores an image or recording and returns the URL to put in the note. */
export async function storeNoteMedia(opts: {
  ownerId: string;
  noteId: string | null;
  bytes: Buffer;
  mimeType: string;
  filename: string;
}) {
  const id = randomBytes(16).toString("base64url");
  const mimeType = opts.mimeType.split(";")[0].toLowerCase();
  const ref = await uploadFileToMongo(opts.bytes, opts.filename, mimeType, { kind: "note-media", mediaId: id });
  try {
    await prisma.noteMedia.create({
      data: {
        id,
        userId: opts.ownerId,
        noteId: opts.noteId,
        mongoIndex: ref.mongoIndex,
        fileId: ref.fileId,
        mimeType,
        size: opts.bytes.length,
      },
    });
  } catch (err) {
    // No row means nothing would ever point at these bytes again.
    await deleteFileFromMongo(ref.mongoIndex, ref.fileId).catch(() => {});
    throw err;
  }
  return `/api/media/${id}`;
}

/**
 * Deletes the stored bytes of every media row matching `where`, then the
 * rows. Bytes first: the row is the only pointer to them.
 */
export async function deleteNoteMedia(where: Prisma.NoteMediaWhereInput) {
  const media = await prisma.noteMedia.findMany({ where, select: { id: true, mongoIndex: true, fileId: true } });
  let deleted = 0;
  for (const m of media) {
    try {
      await deleteFileFromMongo(m.mongoIndex, m.fileId);
      deleted += 1;
    } catch (err) {
      console.error(`[media] failed to delete ${m.fileId}:`, err);
    }
  }
  if (media.length) await prisma.noteMedia.deleteMany({ where: { id: { in: media.map((m) => m.id) } } });
  return deleted;
}
