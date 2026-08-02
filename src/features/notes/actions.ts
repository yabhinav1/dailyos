"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";

const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().optional(),
  doodleData: z.string().nullable().optional(),
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

export async function updateNote(noteId: string, formData: z.infer<typeof updateNoteSchema>) {
  try {
    const userId = await getUserIdOrThrow();

    const existing = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) throw new Error("Note not found or access denied.");

    const validated = updateNoteSchema.parse(formData);

    const updated = await prisma.note.update({
      where: { id: noteId },
      data: validated,
    });

    revalidatePath("/notes");
    return { success: true, data: updated };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to update note") };
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
