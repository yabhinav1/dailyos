import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { resolveNoteAccess } from "@/lib/note-access";
import { MAX_MEDIA_BYTES, isAllowedMediaType, storeNoteMedia } from "@/lib/note-media";

// GridFS needs Node APIs.
export const runtime = "nodejs";

/**
 * Uploads an image or voice recording for a note. Form fields: `file`, plus
 * either `noteId` (the signed-in owner's note) or `shareToken` (an editor
 * working through a share link). Media always belongs to the note's owner,
 * so it goes when they delete the note or their account.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected a form upload." }, { status: 400 });
  }
  const file = form.get("file");
  const noteId = form.get("noteId");
  const shareToken = form.get("shareToken");

  if (!(file instanceof File)) return Response.json({ error: "No file." }, { status: 400 });
  if (file.size > MAX_MEDIA_BYTES) return Response.json({ error: "File is larger than 4MB." }, { status: 413 });
  if (!isAllowedMediaType(file.type)) return Response.json({ error: "Only images and audio can go in a note." }, { status: 415 });

  let ownerId: string;
  let targetNoteId: string | null = null;
  if (typeof shareToken === "string" && shareToken) {
    const access = await resolveNoteAccess(shareToken);
    if (access.status !== "ok" || access.role === "VIEW") {
      return Response.json({ error: "You can't edit this note." }, { status: 403 });
    }
    const note = await prisma.note.findUniqueOrThrow({ where: { id: access.noteId }, select: { userId: true } });
    ownerId = note.userId;
    targetNoteId = access.noteId;
  } else {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    ownerId = session.user.id;
    if (typeof noteId === "string" && noteId) {
      const note = await prisma.note.findFirst({ where: { id: noteId, userId: ownerId }, select: { id: true } });
      if (!note) return Response.json({ error: "Note not found." }, { status: 404 });
      targetNoteId = note.id;
    }
  }

  try {
    const url = await storeNoteMedia({
      ownerId,
      noteId: targetNoteId,
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      filename: file.name || "media",
    });
    return Response.json({ url });
  } catch (err) {
    // Typically: no MongoDB configured, or every cluster full. The editor
    // falls back to keeping small files inline.
    console.error("[media] upload failed:", err);
    return Response.json({ error: "File storage is unavailable right now." }, { status: 503 });
  }
}
