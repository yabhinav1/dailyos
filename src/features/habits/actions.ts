"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";
import { addDays, computeStreaks, isDateKey, keyToUtcDate, utcDateToKey, type HabitFrequency } from "@/lib/dates";
import { getUserToday } from "@/lib/user-time";

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

function asFrequency(value: string): HabitFrequency {
  return value === "WEEKLY" || value === "MONTHLY" ? value : "DAILY";
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

/**
 * Toggles a check-in. `date` is a YYYY-MM-DD day in the user's own zone, and
 * `today` is the browser's idea of today, used to judge the current streak.
 */
export async function logHabit(habitId: string, date: string, today?: string) {
  const userId = await getUserId();
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId } });
  if (!habit) throw new Error("Habit not found.");
  if (!isDateKey(date)) throw new Error("Invalid date.");

  const dateObj = keyToUtcDate(date);

  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId, date: dateObj } },
  });

  if (existing) {
    await prisma.habitLog.delete({ where: { id: existing.id } });
  } else {
    await prisma.habitLog.create({ data: { habitId, date: dateObj, completed: true } });
  }

  await recalculateStreak(habitId, asFrequency(habit.frequency), await getUserToday(userId, today));

  revalidatePath("/habits");
  revalidatePath("/today");
  return { success: true };
}

async function loadLogKeys(habitIds: string[]) {
  const logs = await prisma.habitLog.findMany({
    where: { habitId: { in: habitIds }, completed: true },
    select: { habitId: true, date: true },
  });
  const byHabit = new Map<string, string[]>();
  for (const log of logs) {
    const keys = byHabit.get(log.habitId) ?? [];
    keys.push(utcDateToKey(log.date));
    byHabit.set(log.habitId, keys);
  }
  return byHabit;
}

async function recalculateStreak(habitId: string, frequency: HabitFrequency, todayKey: string) {
  const keys = (await loadLogKeys([habitId])).get(habitId) ?? [];
  const { streak, maxStreak } = computeStreaks(keys, frequency, todayKey);
  await prisma.habit.update({
    where: { id: habitId },
    data: { streak, maxStreak },
  });
}

/**
 * Habits with the last 30 days of logs for the grid. Streaks are worked out
 * here against the user's today rather than read from the stored columns,
 * which only change on a check-in and so would keep showing a broken streak
 * as alive.
 */
export async function getHabitsAction(today?: string) {
  try {
    const userId = await getUserId();
    const todayKey = await getUserToday(userId, today);
    const windowStart = keyToUtcDate(addDays(todayKey, -29));

    const habits = await prisma.habit.findMany({
      where: { userId },
      include: {
        logs: {
          where: { date: { gte: windowStart } },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const logKeys = await loadLogKeys(habits.map((h) => h.id));
    const data = habits.map((h) => ({
      ...h,
      ...computeStreaks(logKeys.get(h.id) ?? [], asFrequency(h.frequency), todayKey),
    }));

    return { success: true, data, today: todayKey };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}
