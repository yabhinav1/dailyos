"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";

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

/** Open goals, for the goal picker in the task form. */
export async function getGoalOptionsAction() {
  try {
    const userId = await getUserId();
    const goals = await prisma.goal.findMany({
      where: { userId, isCompleted: false },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });
    return { success: true, data: goals };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function getGoalsAction() {
  try {
    const userId = await getUserId();
    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: [{ isCompleted: "asc" }, { createdAt: "desc" }],
      include: {
        tasks: { where: { deletedAt: null }, select: { status: true } },
      },
    });
    // A goal with linked tasks gets its progress from them (see
    // syncGoalProgress); the counts let the card say so instead of offering
    // a slider that the next task change would overwrite.
    const data = goals.map(({ tasks, ...goal }) => ({
      ...goal,
      linkedTasks: tasks.length,
      linkedTasksDone: tasks.filter((t) => t.status === "COMPLETED").length,
    }));
    return { success: true, data };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}
