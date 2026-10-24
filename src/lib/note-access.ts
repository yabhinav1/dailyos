import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type NoteRole = "OWNER" | "EDIT" | "VIEW";
export type LinkAccess = "NONE" | "VIEW" | "EDIT";

export const LINK_ACCESS: readonly LinkAccess[] = ["NONE", "VIEW", "EDIT"];
export const SHARE_ROLES = ["VIEW", "EDIT"] as const;

/** 256 random bits, URL-safe. Unguessable, so the link itself is the secret. */
export function newShareToken() {
  return randomBytes(32).toString("base64url");
}

const rank = { VIEW: 1, EDIT: 2, OWNER: 3 } as const;
const best = (a: NoteRole | null, b: NoteRole | null) => (!a ? b : !b ? a : rank[a] >= rank[b] ? a : b);

export type NoteAccess =
  | { status: "ok"; role: NoteRole; noteId: string; userId: string | null; displayName: string }
  | { status: "not-found" }
  | { status: "sign-in" }
  | { status: "no-access"; email: string };

/**
 * Who the caller is to the note behind a share link, Google Docs style:
 * the owner, anyone invited by email (signed in as that address), or anyone
 * at all when link access is on. The strongest applicable role wins. Trashed
 * notes resolve as not found, so trashing a note also closes its link.
 */
export async function resolveNoteAccess(token: string): Promise<NoteAccess> {
  if (!token || token.length < 20) return { status: "not-found" };

  const note = await prisma.note.findFirst({
    where: { shareToken: token, deletedAt: null },
    select: { id: true, userId: true, linkAccess: true },
  });
  if (!note) return { status: "not-found" };

  const access = await resolveRole(note, (email) =>
    prisma.noteShare.findUnique({ where: { noteId_email: { noteId: note.id, email } }, select: { role: true } })
  );
  return access.status === "ok" ? { ...access, noteId: note.id } : access;
}

export type ProjectAccess =
  | { status: "ok"; role: NoteRole; projectId: string; userId: string | null; displayName: string }
  | { status: "not-found" }
  | { status: "sign-in" }
  | { status: "no-access"; email: string };

/** Same rules as resolveNoteAccess, for a project's /p/<token> link. */
export async function resolveProjectAccess(token: string): Promise<ProjectAccess> {
  if (!token || token.length < 20) return { status: "not-found" };

  const project = await prisma.project.findFirst({
    where: { shareToken: token, deletedAt: null },
    select: { id: true, userId: true, linkAccess: true },
  });
  if (!project) return { status: "not-found" };

  const access = await resolveRole(project, (email) =>
    prisma.projectShare.findUnique({ where: { projectId_email: { projectId: project.id, email } }, select: { role: true } })
  );
  return access.status === "ok" ? { ...access, projectId: project.id } : access;
}

type ResolvedRole =
  | { status: "ok"; role: NoteRole; userId: string | null; displayName: string }
  | { status: "sign-in" }
  | { status: "no-access"; email: string };

/** The caller's role on a shared item: owner, invitee, or anyone with the link. */
async function resolveRole(
  item: { userId: string; linkAccess: string },
  findShare: (email: string) => Promise<{ role: string } | null>
): Promise<ResolvedRole> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  // From the database, not the session: the token keeps the address the
  // user signed in with, which goes stale after an email change.
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    : null;
  const email = user?.email.toLowerCase() ?? null;
  const displayName = user?.name || user?.email || "Anonymous";

  let role: NoteRole | null = null;
  if (userId && userId === item.userId) role = "OWNER";
  if (email && role !== "OWNER") {
    const share = await findShare(email);
    if (share) role = best(role, share.role === "EDIT" ? "EDIT" : "VIEW");
  }
  if (item.linkAccess === "EDIT") role = best(role, "EDIT");
  if (item.linkAccess === "VIEW") role = best(role, "VIEW");

  if (role) return { status: "ok", role, userId, displayName };
  if (!userId) return { status: "sign-in" };
  return { status: "no-access", email: email ?? "" };
}
