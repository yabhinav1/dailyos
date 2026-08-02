"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";

const habitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).default("DAILY"),
});

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createHabit(data: z.infer<typeof habitSchema>) {
  const userId = await getUserId();
  const validated = habitSchema.parse(data);
  const habit = await prisma.habit.create({ data: { ...validated, userId } });
  revalidatePath("/habits");
  return { success: true, data: habit };
}

export async function deleteHabit(habitId: string) {
  const userId = await getUserId();
  const existing = await prisma.habit.findFirst({ where: { id: habitId, userId } });
  if (!existing) throw new Error("Habit not found or access denied.");
  await prisma.habit.delete({ where: { id: habitId } });
  revalidatePath("/habits");
  return { success: true };
}

export async function logHabit(habitId: string, date: string) {
  const userId = await getUserId();
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId } });
  if (!habit) throw new Error("Habit not found.");

  const dateObj = new Date(date);

  // Check if already logged
  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId, date: dateObj } },
  });

  if (existing) {
    // Toggle off — remove log
    await prisma.habitLog.delete({ where: { id: existing.id } });
    // Recalculate streak
    await recalculateStreak(habitId);
  } else {
    // Add log
    await prisma.habitLog.create({ data: { habitId, date: dateObj, completed: true } });
    // Recalculate streak
    await recalculateStreak(habitId);
  }

  revalidatePath("/habits");
  return { success: true };
}

async function recalculateStreak(habitId: string) {
  const logs = await prisma.habitLog.findMany({
    where: { habitId, completed: true },
    orderBy: { date: "desc" },
  });

  let streak = 0;
  let maxStreak = 0;
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate current streak (consecutive days from today backward)
  for (let i = 0; i < logs.length; i++) {
    const logDate = new Date(logs[i].date);
    logDate.setHours(0, 0, 0, 0);
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);

    if (logDate.getTime() === expectedDate.getTime()) {
      currentStreak++;
    } else {
      break;
    }
  }
  streak = currentStreak;

  // Calculate max streak
  let tempStreak = 0;
  for (let i = 0; i < logs.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const curr = new Date(logs[i].date);
      const prev = new Date(logs[i - 1].date);
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    maxStreak = Math.max(maxStreak, tempStreak);
  }

  await prisma.habit.update({
    where: { id: habitId },
    data: { streak, maxStreak },
  });
}

export async function getHabitsAction() {
  try {
    const userId = await getUserId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);

    const habits = await prisma.habit.findMany({
      where: { userId },
      include: {
        logs: {
          where: { date: { gte: thirtyDaysAgo } },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return { success: true, data: habits };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}
