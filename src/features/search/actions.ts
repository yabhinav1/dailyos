"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";

export type SearchHit = {
  kind: "note" | "task" | "project" | "goal" | "event" | "habit";
  id: string;
  title: string;
  /** A short line of context: a snippet, status or date. */
  detail: string | null;
  href: string;
};

const PER_KIND = 5;

/** Plain text around the first match, for a one-line preview. */
function snippet(text: string | null | undefined, query: string): string | null {
  if (!text) return null;
  const plain = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return null;
  const at = plain.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return plain.slice(0, 80);
  const start = Math.max(0, at - 30);
  return (start > 0 ? "…" : "") + plain.slice(start, start + 90);
}

/**
 * Searches the user's notes, tasks, projects, goals, events and habits for
 * the command palette. Case-insensitive substring match on titles and text.
 */
export async function searchEverything(rawQuery: string) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new Error("Unauthorized");

    const q = rawQuery.trim().slice(0, 100);
    if (q.length < 2) return { success: true, data: [] as SearchHit[] };
    const has = { contains: q, mode: "insensitive" as const };

    const [notes, tasks, projects, goals, events, habits] = await Promise.all([
      prisma.note.findMany({
        where: { userId, deletedAt: null, OR: [{ title: has }, { content: has }] },
        select: { id: true, title: true, content: true },
        orderBy: { updatedAt: "desc" },
        take: PER_KIND,
      }),
      prisma.task.findMany({
        where: { userId, deletedAt: null, OR: [{ title: has }, { description: has }] },
        select: { id: true, title: true, status: true, description: true },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: PER_KIND,
      }),
      prisma.project.findMany({
        where: { userId, deletedAt: null, OR: [{ name: has }, { description: has }] },
        select: { id: true, name: true, description: true },
        orderBy: { updatedAt: "desc" },
        take: PER_KIND,
      }),
      prisma.goal.findMany({
        where: { userId, OR: [{ title: has }, { description: has }] },
        select: { id: true, title: true, progress: true },
        orderBy: { updatedAt: "desc" },
        take: PER_KIND,
      }),
      prisma.calendarEvent.findMany({
        where: { userId, OR: [{ title: has }, { description: has }] },
        select: { id: true, title: true, startDate: true },
        orderBy: { startDate: "desc" },
        take: PER_KIND,
      }),
      prisma.habit.findMany({
        where: { userId, name: has },
        select: { id: true, name: true, frequency: true },
        take: PER_KIND,
      }),
    ]);

    const hits: SearchHit[] = [
      ...notes.map((n) => ({
        kind: "note" as const,
        id: n.id,
        title: n.title || "Untitled note",
        detail: snippet(n.content, q),
        href: `/notes?note=${n.id}`,
      })),
      ...tasks.map((t) => ({
        kind: "task" as const,
        id: t.id,
        title: t.title,
        detail: t.status === "COMPLETED" ? "Completed" : snippet(t.description, q),
        href: `/tasks?q=${encodeURIComponent(t.title)}`,
      })),
      ...projects.map((p) => ({
        kind: "project" as const,
        id: p.id,
        title: p.name,
        detail: snippet(p.description, q),
        href: "/projects",
      })),
      ...goals.map((g) => ({ kind: "goal" as const, id: g.id, title: g.title, detail: `${g.progress}%`, href: "/goals" })),
      ...events.map((e) => ({
        kind: "event" as const,
        id: e.id,
        title: e.title,
        detail: e.startDate.toISOString(),
        href: "/calendar",
      })),
      ...habits.map((h) => ({
        kind: "habit" as const,
        id: h.id,
        title: h.name,
        detail: h.frequency.toLowerCase(),
        href: "/habits",
      })),
    ];

    return { success: true, data: hits };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Search failed"), data: [] as SearchHit[] };
  }
}
