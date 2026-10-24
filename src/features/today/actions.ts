"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import {
  addDays,
  computeStreaks,
  isValidTimezone,
  keyToUtcDate,
  periodIndex,
  utcDateToKey,
  zonedDayStart,
  type HabitFrequency,
} from "@/lib/dates";
import { listEventOccurrences } from "@/lib/events";
import { getUserTimezone, getUserToday } from "@/lib/user-time";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const taskSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  dueTime: true,
  recurrence: true,
  project: { select: { name: true } },
} as const;

/**
 * Everything the Today page shows, for the user's own day: tasks due and
 * overdue, habits and whether this period's check-in is done, today's
 * events, focus minutes logged, and the goals closest to their deadline.
 */
export async function getTodayAction(today?: string, timezone?: string) {
  try {
    const userId = await getUserId();
    const todayKey = await getUserToday(userId, today);
    const tz = isValidTimezone(timezone) ? timezone : await getUserTimezone(userId);
    const todayDate = keyToUtcDate(todayKey);

    const [user, overdue, dueToday, habits, events, sessions, goals] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.task.findMany({
        where: { userId, deletedAt: null, status: { not: "COMPLETED" }, dueDate: { lt: todayDate } },
        select: taskSelect,
        orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
        take: 20,
      }),
      prisma.task.findMany({
        where: { userId, deletedAt: null, dueDate: todayDate },
        select: taskSelect,
        orderBy: [{ status: "asc" }, { dueTime: "asc" }, { priority: "asc" }],
      }),
      prisma.habit.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          frequency: true,
          // Dates only: the full history is needed for the streak.
          logs: { where: { completed: true }, select: { date: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      listEventOccurrences(userId, todayKey, todayKey, tz),
      prisma.studySession.findMany({
        where: {
          userId,
          completedAt: { gte: zonedDayStart(todayKey, tz), lt: zonedDayStart(addDays(todayKey, 1), tz) },
        },
        select: { duration: true },
      }),
      prisma.goal.findMany({
        where: { userId, isCompleted: false },
        select: { id: true, title: true, progress: true, targetDate: true },
        orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        take: 3,
      }),
    ]);

    const habitRows = habits.map((h) => {
      const frequency: HabitFrequency = h.frequency === "WEEKLY" || h.frequency === "MONTHLY" ? h.frequency : "DAILY";
      const keys = h.logs.map((l) => utcDateToKey(l.date));
      const current = periodIndex(todayKey, frequency);
      return {
        id: h.id,
        name: h.name,
        frequency,
        doneToday: keys.includes(todayKey),
        donePeriod: keys.some((k) => periodIndex(k, frequency) === current),
        streak: computeStreaks(keys, frequency, todayKey).streak,
      };
    });

    return {
      success: true,
      data: {
        today: todayKey,
        name: user?.name ?? null,
        overdue,
        dueToday,
        habits: habitRows,
        events,
        focusMinutes: sessions.reduce((sum, s) => sum + s.duration, 0),
        goals,
      },
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to load today") };
  }
}
