"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { assertInviteBudget } from "@/lib/invite-limit";
import { keepRevisionBeforeSave } from "@/lib/note-revisions";
import { createNotification } from "@/lib/notifications";
import { sendNoteSharedEmail } from "@/lib/email";
import { LINK_ACCESS, SHARE_ROLES, newShareToken, resolveNoteAccess, type LinkAccess } from "@/lib/note-access";

async function getUserIdOrThrow() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

/** The note, if the caller owns it and it isn't trashed. */
async function ownedNote(noteId: string, userId: string) {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId, deletedAt: null } });
  if (!note) throw new Error("Note not found or access denied.");
  return note;
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const linkFor = (token: string) => `${appUrl()}/s/${token}`;

/** The owner's view of sharing; creates the link token on first open. */
export async function getShareSettingsAction(noteId: string) {
  try {
    const userId = await getUserIdOrThrow();
    let note = await ownedNote(noteId, userId);
    if (!note.shareToken) {
      note = await prisma.note.update({ where: { id: noteId }, data: { shareToken: newShareToken() } });
    }
    const shares = await prisma.noteShare.findMany({
      where: { noteId },
      select: { id: true, email: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      success: true,
      data: { link: linkFor(note.shareToken!), linkAccess: note.linkAccess as LinkAccess, shares },
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to load sharing") };
  }
}

export async function setLinkAccessAction(noteId: string, access: LinkAccess) {
  const userId = await getUserIdOrThrow();
  await ownedNote(noteId, userId);
  const linkAccess = z.enum(LINK_ACCESS as [LinkAccess, ...LinkAccess[]]).parse(access);
  await prisma.note.update({ where: { id: noteId }, data: { linkAccess } });
  revalidatePath("/notes");
  return { success: true };
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.enum(SHARE_ROLES),
});

/**
 * Shares the note with an address, or changes that person's role. They get
 * an email with the link, plus an in-app notification if they have an
 * account already.
 */
export async function inviteToNoteAction(noteId: string, email: string, role: "VIEW" | "EDIT") {
  try {
    const userId = await getUserIdOrThrow();
    const note = await ownedNote(noteId, userId);
    const input = inviteSchema.parse({ email, role });

    const owner = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (owner?.email.toLowerCase() === input.email) throw new Error("That's your own address — you already own this note.");

    const count = await prisma.noteShare.count({ where: { noteId } });
    if (count >= 50) throw new Error("A note can be shared with at most 50 people.");
    await assertInviteBudget(userId);

    const token = note.shareToken ?? newShareToken();
    if (!note.shareToken) await prisma.note.update({ where: { id: noteId }, data: { shareToken: token } });

    const existing = await prisma.noteShare.findUnique({ where: { noteId_email: { noteId, email: input.email } } });
    const share = await prisma.noteShare.upsert({
      where: { noteId_email: { noteId, email: input.email } },
      update: { role: input.role },
      create: { noteId, email: input.email, role: input.role },
      select: { id: true, email: true, role: true },
    });

    // Only a new invite is announced; a role change is silent, as in Docs.
    if (!existing) {
      const sharedBy = owner?.name || owner?.email || "Someone";
      const title = note.title || "Untitled note";
      const invitee = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (invitee) {
        await createNotification(invitee.id, "Note shared with you", `${sharedBy} shared "${title}"`, "INFO");
      }
      try {
        await sendNoteSharedEmail(input.email, sharedBy, title, input.role, linkFor(token));
      } catch (err) {
        // The share stands even if the email bounces; the owner can copy the link.
        console.error("[share] invite email failed:", err);
      }
    }

    revalidatePath("/notes");
    return { success: true, data: share };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to share note") };
  }
}

export async function removeNoteShareAction(shareId: string) {
  const userId = await getUserIdOrThrow();
  const share = await prisma.noteShare.findFirst({ where: { id: shareId, note: { userId } }, select: { id: true } });
  if (!share) throw new Error("Not found or access denied.");
  await prisma.noteShare.delete({ where: { id: shareId } });
  revalidatePath("/notes");
  return { success: true };
}

/** Issues a new link; the old one stops working for anyone not invited. */
export async function resetShareLinkAction(noteId: string) {
  const userId = await getUserIdOrThrow();
  await ownedNote(noteId, userId);
  const note = await prisma.note.update({ where: { id: noteId }, data: { shareToken: newShareToken() } });
  return { success: true, data: { link: linkFor(note.shareToken!) } };
}

/** Notes other people have shared with the signed-in user's address. */
export async function getNotesSharedWithMeAction() {
  try {
    const userId = await getUserIdOrThrow();
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!me) throw new Error("Unauthorized");
    const shares = await prisma.noteShare.findMany({
      where: { email: me.email.toLowerCase(), note: { deletedAt: null, NOT: { userId } } },
      select: {
        role: true,
        note: {
          select: { title: true, shareToken: true, updatedAt: true, user: { select: { name: true, email: true } } },
        },
      },
      orderBy: { note: { updatedAt: "desc" } },
    });
    return {
      success: true,
      data: shares
        .filter((s) => s.note.shareToken)
        .map((s) => ({
          token: s.note.shareToken!,
          title: s.note.title || "Untitled note",
          role: s.role,
          owner: s.note.user.name || s.note.user.email,
          updatedAt: s.note.updatedAt,
        })),
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error), data: [] };
  }
}

// -------------------------------------------------------------
// Collaborators: reading and saving through the link
// -------------------------------------------------------------

/** The shared note as the caller may see it; polled to pick up others' edits. */
export async function getSharedNoteAction(token: string) {
  try {
    const access = await resolveNoteAccess(token);
    if (access.status !== "ok") return { success: false, status: access.status };
    const note = await prisma.note.findUniqueOrThrow({
      where: { id: access.noteId },
      select: {
        id: true,
        title: true,
        content: true,
        updatedAt: true,
        lastEditedBy: true,
        user: { select: { name: true, email: true } },
      },
    });
    return {
      success: true,
      data: {
        id: note.id,
        title: note.title,
        content: note.content ?? "",
        updatedAt: note.updatedAt.toISOString(),
        lastEditedBy: note.lastEditedBy,
        owner: note.user.name || note.user.email,
        role: access.role,
      },
    };
  } catch (error: unknown) {
    return { success: false, status: "error" as const, message: getErrorMessage(error) };
  }
}

const sharedSaveSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(5_000_000).optional(),
});

/**
 * Saves a collaborator's edit, but only on top of the version they loaded
 * (`baseUpdatedAt`). If someone saved in between, nothing is written and the
 * latest version comes back so the editor can resolve it.
 */
export async function saveSharedNoteAction(
  token: string,
  patch: { title?: string; content?: string },
  baseUpdatedAt: string
) {
  try {
    const access = await resolveNoteAccess(token);
    if (access.status !== "ok") return { success: false as const, conflict: false as const, message: "You no longer have access." };
    if (access.role === "VIEW") return { success: false as const, conflict: false as const, message: "You can only view this note." };

    const data = sharedSaveSchema.parse(patch);
    const current = await prisma.note.findUniqueOrThrow({ where: { id: access.noteId } });
    if (current.updatedAt.toISOString() === new Date(baseUpdatedAt).toISOString()) {
      await keepRevisionBeforeSave(current, data);
    }
    const result = await prisma.note.updateMany({
      where: { id: access.noteId, updatedAt: new Date(baseUpdatedAt) },
      data: { ...data, lastEditedBy: access.displayName },
    });

    const latest = await prisma.note.findUniqueOrThrow({
      where: { id: access.noteId },
      select: { title: true, content: true, updatedAt: true, lastEditedBy: true },
    });
    const snapshot = {
      title: latest.title,
      content: latest.content ?? "",
      updatedAt: latest.updatedAt.toISOString(),
      lastEditedBy: latest.lastEditedBy,
    };

    if (result.count === 0) return { success: false as const, conflict: true as const, latest: snapshot };
    return { success: true as const, conflict: false as const, latest: snapshot };
  } catch (error: unknown) {
    return { success: false as const, conflict: false as const, message: getErrorMessage(error, "Failed to save") };
  }
}
