"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getAnalyticsData() {
  try {
    const userId = await getUserId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    // Queries
    const [tasks, goals, habits, studySessions] = await Promise.all([
      prisma.task.findMany({
        where: { userId },
        select: { status: true, createdAt: true },
      }),
      prisma.goal.findMany({
        where: { userId },
        select: { isCompleted: true },
      }),
      prisma.habit.findMany({
        where: { userId },
        include: {
          logs: {
            where: { date: { gte: sevenDaysAgo } },
            select: { date: true },
          },
        },
      }),
      prisma.studySession.findMany({
        where: { userId, completedAt: { gte: sevenDaysAgo } },
        select: { duration: true, completedAt: true },
      }),
    ]);

    // Aggregate Tasks Done / Pending
    const completedTasksCount = tasks.filter(t => t.status === "COMPLETED").length;
    const totalTasksCount = tasks.length;

    // Aggregate Goals
    const completedGoalsCount = goals.filter(g => g.isCompleted).length;
    const totalGoalsCount = goals.length;

    // Last 7 days dates array
    const chartDays = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      return d.toISOString().split("T")[0];
    });

    // Populate habit check-ins and study hours per day
    const habitStats = chartDays.map(day => {
      const count = habits.reduce((acc, h) => {
        const logged = h.logs.some(l => l.date.toISOString().split("T")[0] === day);
        return acc + (logged ? 1 : 0);
      }, 0);
      return { day, count };
    });

    const studyStats = chartDays.map(day => {
      const totalMin = studySessions.reduce((acc, s) => {
        const isSameDay = s.completedAt.toISOString().split("T")[0] === day;
        return acc + (isSameDay ? s.duration : 0);
      }, 0);
      return { day, hours: Math.round((totalMin / 60) * 10) / 10 };
    });

    return {
      success: true,
      data: {
        tasks: { completed: completedTasksCount, total: totalTasksCount },
        goals: { completed: completedGoalsCount, total: totalGoalsCount },
        habitStats,
        studyStats,
        habitsCount: habits.length,
      },
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}
