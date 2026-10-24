import { prisma } from "@/lib/prisma";

/** A new version is kept at most this often per note while someone edits. */
const MIN_GAP_MS = 10 * 60 * 1000;
/** Oldest versions beyond this many are dropped. */
const KEEP = 50;

type NoteState = {
  id: string;
  title: string;
  content: string | null;
  doodleData: string | null;
  canvasData: string | null;
  lastEditedBy: string | null;
  updatedAt: Date;
  createdAt: Date;
};

type Patch = { title?: string; content?: string; doodleData?: string | null; canvasData?: string | null };

/**
 * Called just before a save. If the save changes the note and no version has
 * been kept in the last ten minutes, the note as it stands now is stored as
 * a revision. Autosave fires every second while typing, so this turns a
 * stream of saves into one version per editing session.
 */
export async function keepRevisionBeforeSave(note: NoteState, patch: Patch, { force = false } = {}) {
  const changes =
    (patch.title !== undefined && patch.title !== note.title) ||
    (patch.content !== undefined && patch.content !== (note.content ?? "")) ||
    (patch.doodleData !== undefined && patch.doodleData !== note.doodleData) ||
    (patch.canvasData !== undefined && patch.canvasData !== note.canvasData);
  if (!changes) return;
  // An empty note (typically one just created) isn't worth going back to.
  const empty = !(note.content ?? "").replace(/<[^>]*>/g, "").trim() && !note.doodleData && !note.canvasData;
  if (empty) return;

  const latest = await prisma.noteRevision.findFirst({
    where: { noteId: note.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  // Measured from the last kept version, or from the note's creation if it
  // has none, so writing a brand-new note doesn't produce versions of itself.
  const since = latest?.createdAt ?? note.createdAt;
  if (!force && Date.now() - since.getTime() < MIN_GAP_MS) return;

  await prisma.noteRevision.create({
    data: {
      noteId: note.id,
      title: note.title,
      content: note.content,
      doodleData: note.doodleData,
      canvasData: note.canvasData,
      editedBy: note.lastEditedBy,
      savedAt: note.updatedAt,
    },
  });

  const stale = await prisma.noteRevision.findMany({
    where: { noteId: note.id },
    orderBy: { createdAt: "desc" },
    skip: KEEP,
    select: { id: true },
  });
  if (stale.length) await prisma.noteRevision.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
}
