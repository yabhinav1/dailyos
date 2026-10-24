"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// ── Subjects ──
const subjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  color: z.string().optional(),
});

export async function createSubject(data: z.infer<typeof subjectSchema>) {
  const userId = await getUserId();
  const validated = subjectSchema.parse(data);
  const subject = await prisma.studySubject.create({ data: { ...validated, userId } });
  revalidatePath("/study");
  return { success: true, data: subject };
}

export async function deleteSubject(subjectId: string) {
  const userId = await getUserId();
  const existing = await prisma.studySubject.findFirst({ where: { id: subjectId, userId } });
  if (!existing) throw new Error("Subject not found.");
  await prisma.studySubject.delete({ where: { id: subjectId } });
  revalidatePath("/study");
  return { success: true };
}

// ── Topics ──
const topicSchema = z.object({
  subjectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

export async function createTopic(data: z.infer<typeof topicSchema>) {
  await getUserId();
  const validated = topicSchema.parse(data);
  const topic = await prisma.studyTopic.create({ data: validated });
  revalidatePath("/study");
  return { success: true, data: topic };
}

export async function toggleTopicCompleted(topicId: string, isCompleted: boolean) {
  await getUserId();
  await prisma.studyTopic.update({
    where: { id: topicId },
    data: { isCompleted, lastRevised: isCompleted ? new Date() : null, revisionCount: { increment: isCompleted ? 1 : 0 } },
  });
  revalidatePath("/study");
  return { success: true };
}

// ── Sessions ──
export async function logStudySession(subjectId: string | null, duration: number, notes?: string) {
  const userId = await getUserId();
  await prisma.studySession.create({
    data: { userId, subjectId, duration, notes },
  });
  revalidatePath("/study");
  return { success: true };
}

export async function deleteStudySession(sessionId: string) {
  const userId = await getUserId();
  const existing = await prisma.studySession.findFirst({ where: { id: sessionId, userId } });
  if (!existing) throw new Error("Session not found.");
  await prisma.studySession.delete({ where: { id: sessionId } });
  revalidatePath("/study");
  return { success: true };
}

// ── Queries ──
export async function getStudyDataAction() {
  try {
    const userId = await getUserId();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [subjects, recentSessions] = await Promise.all([
      prisma.studySubject.findMany({
        where: { userId },
        include: { topics: { orderBy: { createdAt: "asc" } }, _count: { select: { sessions: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.studySession.findMany({
        where: { userId, completedAt: { gte: sevenDaysAgo } },
        include: { subject: { select: { name: true, color: true } } },
        orderBy: { completedAt: "desc" },
      }),
    ]);

    const totalMinutes = recentSessions.reduce((acc, s) => acc + s.duration, 0);

    return { success: true, data: { subjects, recentSessions, totalMinutesThisWeek: totalMinutes } };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}
