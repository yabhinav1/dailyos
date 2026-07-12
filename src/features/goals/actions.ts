"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const goalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetDate: z.string().nullable().optional(),
  timeframe: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
  progress: z.number().min(0).max(100).optional(),
});

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createGoal(data: z.infer<typeof goalSchema>) {
  const userId = await getUserId();
  const validated = goalSchema.parse(data);
  const goal = await prisma.goal.create({
    data: {
      ...validated,
      userId,
      targetDate: validated.targetDate ? new Date(validated.targetDate) : null,
    },
  });
  revalidatePath("/goals");
  return { success: true, data: goal };
}

export async function updateGoalProgress(goalId: string, progress: number) {
  const userId = await getUserId();
  const existing = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!existing) throw new Error("Goal not found.");
  const isCompleted = progress >= 100;
  await prisma.goal.update({ where: { id: goalId }, data: { progress, isCompleted } });
  revalidatePath("/goals");
  return { success: true };
}

export async function deleteGoal(goalId: string) {
  const userId = await getUserId();
  const existing = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!existing) throw new Error("Goal not found.");
  await prisma.goal.delete({ where: { id: goalId } });
  revalidatePath("/goals");
  return { success: true };
}

export async function getGoalsAction() {
  try {
    const userId = await getUserId();
    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: [{ isCompleted: "asc" }, { createdAt: "desc" }],
    });
    return { success: true, data: goals };
  } catch (error: any) {
    return { success: false, message: error?.message };
  }
}
