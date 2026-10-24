"use client";

/** Where an upload belongs: the owner's note, or a note opened by share link. */
export type MediaTarget = { noteId?: string; shareToken?: string };

const MAX_UPLOAD = 4 * 1024 * 1024; // matches MAX_MEDIA_BYTES on the server
const MAX_INLINE = 1.5 * 1024 * 1024; // fallback when storage is unavailable
const MAX_EDGE = 2560;

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * Large photos come straight off phones at 5-12MB. Anything over the upload
 * limit or wider than 2560px is redrawn as WebP, which keeps it sharp on
 * screen at a fraction of the size. GIFs are left alone (re-encoding would
 * drop the animation).
 */
async function shrinkImage(file: Blob): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_UPLOAD) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.7, 0.5]) {
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    if (out && out.size <= MAX_UPLOAD) return out;
  }
  return file;
}

/**
 * Stores an image or recording and returns the URL to put in the note. If
 * file storage isn't available, a small file is kept inline as before;
 * anything larger is refused rather than bloating the note.
 */
export async function uploadMedia(blob: Blob, filename: string, target: MediaTarget): Promise<string> {
  const file = blob.type.startsWith("image/") ? await shrinkImage(blob) : blob;
  if (file.size > MAX_UPLOAD) {
    throw new Error(blob.type.startsWith("audio/") ? "That recording is too long to save (about 4 minutes max)." : "That image is too large (4MB max).");
  }

  const form = new FormData();
  form.append("file", file, filename);
  if (target.shareToken) form.append("shareToken", target.shareToken);
  else if (target.noteId) form.append("noteId", target.noteId);

  try {
    const res = await fetch("/api/media", { method: "POST", body: form });
    if (res.ok) return ((await res.json()) as { url: string }).url;
    if (res.status !== 503) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "Upload failed.");
    }
  } catch (err) {
    if (err instanceof Error && err.message !== "Failed to fetch" && !/storage/i.test(err.message)) throw err;
  }

  if (file.size <= MAX_INLINE) return readAsDataUrl(file);
  throw new Error("File storage is unavailable right now, and the file is too big to keep inline.");
}
