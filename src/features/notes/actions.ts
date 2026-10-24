"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";
import { keepRevisionBeforeSave } from "@/lib/note-revisions";
import { hardDeleteTrashed } from "@/lib/trash-purge";

const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().optional(),
  doodleData: z.string().nullable().optional(),
  canvasData: z.string().nullable().optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  color: z.string().optional(),
  folderId: z.string().nullable().optional(),
});

const updateNoteSchema = createNoteSchema.partial();

const createFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  color: z.string().optional(),
});

async function getUserIdOrThrow() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// -------------------------------------------------------------
// NOTE ACTIONS
// -------------------------------------------------------------

export async function createNote(formData: z.infer<typeof createNoteSchema>) {
  try {
    const userId = await getUserIdOrThrow();
    const validated = createNoteSchema.parse(formData);

    const note = await prisma.note.create({
      data: { ...validated, userId },
    });

    revalidatePath("/notes");
    return { success: true, data: note };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to create note") };
  }
}

/**
 * Saves the owner's edit. With `baseUpdatedAt` (sent for shared notes) the
 * write only lands on top of that version; if a collaborator saved in
 * between, nothing is written and `conflict` comes back with the latest.
 */
export async function updateNote(
  noteId: string,
  formData: z.infer<typeof updateNoteSchema>,
  baseUpdatedAt?: string
) {
  try {
    const userId = await getUserIdOrThrow();

    const existing = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) throw new Error("Note not found or access denied.");

    const validated = updateNoteSchema.parse(formData);

    // A save that is about to be refused as a conflict changes nothing, so
    // it keeps nothing either.
    if (!baseUpdatedAt || existing.updatedAt.toISOString() === new Date(baseUpdatedAt).toISOString()) {
      await keepRevisionBeforeSave(existing, validated);
    }

    // Collaborators see who saved last; only worth a lookup on shared notes.
    const shared = existing.linkAccess !== "NONE" || (await prisma.noteShare.count({ where: { noteId } })) > 0;
    const lastEditedBy = shared
      ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }).then((u) => u?.name || u?.email || null)
      : existing.lastEditedBy;

    if (baseUpdatedAt) {
      const result = await prisma.note.updateMany({
        where: { id: noteId, updatedAt: new Date(baseUpdatedAt) },
        data: { ...validated, lastEditedBy },
      });
      const latest = await prisma.note.findUniqueOrThrow({ where: { id: noteId } });
      if (result.count === 0) return { success: false, conflict: true, data: latest, message: "Someone else edited this note." };
      revalidatePath("/notes");
      return { success: true, data: latest };
    }

    const updated = await prisma.note.update({
      where: { id: noteId },
      data: { ...validated, lastEditedBy },
    });

    revalidatePath("/notes");
    return { success: true, data: updated };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to update note") };
  }
}

/** Version stamp and editor of a note, polled while a shared note is open. */
export async function getNoteVersionAction(noteId: string) {
  try {
    const userId = await getUserIdOrThrow();
    const note = await prisma.note.findFirst({
      where: { id: noteId, userId },
      select: { updatedAt: true, lastEditedBy: true },
    });
    if (!note) throw new Error("Note not found.");
    return { success: true, data: { updatedAt: note.updatedAt.toISOString(), lastEditedBy: note.lastEditedBy } };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/** The whole note, to load a collaborator's newer version into the editor. */
/** Earlier versions of a note, newest first, without their (large) bodies. */
export async function getNoteRevisionsAction(noteId: string) {
  try {
    const userId = await getUserIdOrThrow();
    const revisions = await prisma.noteRevision.findMany({
      where: { noteId, note: { userId } },
      orderBy: { savedAt: "desc" },
      select: { id: true, title: true, editedBy: true, savedAt: true },
    });
    return { success: true, data: revisions };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error), data: [] };
  }
}

/**
 * Puts an earlier version back. The current version is always kept first,
 * whatever the ten-minute rule says, so a restore can itself be undone.
 */
export async function restoreNoteRevisionAction(revisionId: string) {
  try {
    const userId = await getUserIdOrThrow();
    const revision = await prisma.noteRevision.findFirst({
      where: { id: revisionId, note: { userId } },
      include: { note: true },
    });
    if (!revision) throw new Error("Version not found.");
    const restored = {
      title: revision.title,
      content: revision.content ?? "",
      doodleData: revision.doodleData,
      canvasData: revision.canvasData,
    };
    await keepRevisionBeforeSave(revision.note, restored, { force: true });
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const note = await prisma.note.update({
      where: { id: revision.noteId },
      data: { ...restored, lastEditedBy: me?.name || me?.email || null },
    });
    revalidatePath("/notes");
    return { success: true, data: note };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Couldn't restore that version") };
  }
}

export async function getNoteAction(noteId: string) {
  try {
    const userId = await getUserIdOrThrow();
    const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) throw new Error("Note not found.");
    return { success: true, data: note };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function deleteNote(noteId: string) {
  try {
    const userId = await getUserIdOrThrow();

    const existing = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) throw new Error("Note not found or access denied.");

    await prisma.note.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/notes");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to delete note") };
  }
}

/**
 * Undoes a soft delete. Used by the Undo button on the deletion toast and by
 * the Trash page.
 */
export async function restoreNote(noteId: string) {
  try {
    const userId = await getUserIdOrThrow();

    const existing = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) throw new Error("Note not found or access denied.");

    await prisma.note.update({
      where: { id: noteId },
      data: { deletedAt: null },
    });

    revalidatePath("/notes");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to restore note") };
  }
}

/** Permanently deletes a note that is already in the trash. */
export async function hardDeleteNote(noteId: string) {
  try {
    const userId = await getUserIdOrThrow();

    const existing = await prisma.note.findFirst({
      where: { id: noteId, userId, deletedAt: { not: null } },
    });
    if (!existing) throw new Error("Note not found in trash or access denied.");

    await hardDeleteTrashed({ notes: { id: noteId, userId } });

    revalidatePath("/notes");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to delete note") };
  }
}

export async function toggleNotePin(noteId: string, isPinned: boolean) {
  try {
    const userId = await getUserIdOrThrow();
    const existing = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) throw new Error("Note not found or access denied.");

    await prisma.note.update({ where: { id: noteId }, data: { isPinned } });
    revalidatePath("/notes");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to update note") };
  }
}

export async function toggleNoteFavorite(noteId: string, isFavorite: boolean) {
  try {
    const userId = await getUserIdOrThrow();
    const existing = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) throw new Error("Note not found or access denied.");

    await prisma.note.update({ where: { id: noteId }, data: { isFavorite } });
    revalidatePath("/notes");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to update note") };
  }
}

// -------------------------------------------------------------
// FOLDER ACTIONS
// -------------------------------------------------------------

export async function createFolder(formData: z.infer<typeof createFolderSchema>) {
  try {
    const userId = await getUserIdOrThrow();
    const validated = createFolderSchema.parse(formData);

    const folder = await prisma.noteFolder.create({
      data: { ...validated, userId },
    });

    revalidatePath("/notes");
    return { success: true, data: folder };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to create folder") };
  }
}

export async function deleteFolder(folderId: string) {
  try {
    const userId = await getUserIdOrThrow();
    const existing = await prisma.noteFolder.findFirst({ where: { id: folderId, userId } });
    if (!existing) throw new Error("Folder not found or access denied.");

    // Move notes from this folder to "no folder" first
    await prisma.note.updateMany({
      where: { folderId, userId },
      data: { folderId: null },
    });

    await prisma.noteFolder.delete({ where: { id: folderId } });
    revalidatePath("/notes");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to delete folder") };
  }
}

// -------------------------------------------------------------
// QUERY ACTIONS
// -------------------------------------------------------------

export async function getNotesAction(search?: string, folderId?: string | null) {
  try {
    const userId = await getUserIdOrThrow();

    const whereClause: Prisma.NoteWhereInput = {
      userId,
      deletedAt: null,
    };

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    if (folderId !== undefined) {
      whereClause.folderId = folderId;
    }

    const notes = await prisma.note.findMany({
      where: whereClause,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      // The share count marks notes others can edit, which the editor
      // then keeps in sync.
      include: { _count: { select: { shares: true } } },
    });

    return { success: true, data: notes };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to fetch notes") };
  }
}

export async function getFoldersAction() {
  try {
    const userId = await getUserIdOrThrow();

    const folders = await prisma.noteFolder.findMany({
      where: { userId },
      include: {
        _count: {
          select: { notes: { where: { deletedAt: null } } },
        },
      },
      orderBy: { name: "asc" },
    });

    return { success: true, data: folders };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to fetch folders") };
  }
}

// -------------------------------------------------------------
// GUEST -> ACCOUNT MIGRATION
// -------------------------------------------------------------

const guestNoteSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  doodleData: z.string().nullable().optional(),
});

/**
 * Bulk-imports notes a user created while browsing as a guest
 * (stored client-side in localStorage) into their real account
 * the moment they log in or register.
 */
export async function importGuestNotes(
  guestNotes: { title: string; content?: string; doodleData?: string | null }[]
) {
  try {
    const userId = await getUserIdOrThrow();

    if (!Array.isArray(guestNotes) || guestNotes.length === 0) {
      return { success: true, imported: 0 };
    }

    const validated = guestNotes
      .map((n) => {
        const parsed = guestNoteSchema.safeParse(n);
        return parsed.success ? parsed.data : null;
      })
      .filter((n): n is z.infer<typeof guestNoteSchema> => n !== null)
      .slice(0, 100); // sanity cap so a corrupted localStorage blob can't spam the DB

    if (validated.length === 0) {
      return { success: true, imported: 0 };
    }

    await prisma.note.createMany({
      data: validated.map((n) => ({
        userId,
        title: n.title,
        content: n.content || "",
        doodleData: n.doodleData || null,
      })),
    });

    revalidatePath("/notes");
    return { success: true, imported: validated.length };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to import guest notes"), imported: 0 };
  }
}
