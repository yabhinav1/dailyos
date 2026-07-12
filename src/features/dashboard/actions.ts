"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getDashboardData() {
  try {
    const userId = await getUserId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [tasks, habits, codingProjects, studySubjects, recentActivities] = await Promise.all([
      prisma.task.findMany({
        where: { userId },
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
        take: 10,
      }),
      prisma.habit.findMany({
        where: { userId },
        include: {
          logs: {
            where: { date: today },
            select: { completed: true },
          },
        },
      }),
      prisma.codingProject.findMany({
        where: { userId },
        select: { id: true, name: true, status: true, techStack: true },
        take: 3,
      }),
      prisma.studySubject.findMany({
        where: { userId },
        include: {
          topics: { select: { isCompleted: true } },
        },
        take: 3,
      }),
      prisma.activityHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const completedTasksCount = tasks.filter(t => t.status === "COMPLETED").length;
    const totalTasksCount = tasks.length;

    const completedHabitsToday = habits.filter(h => h.logs.length > 0).length;

    return {
      success: true,
      data: {
        tasks,
        completedTasksCount,
        totalTasksCount,
        habits,
        completedHabitsToday,
        codingProjects,
        studySubjects,
        recentActivities,
      },
    };
  } catch (error: any) {
    return { success: false, message: error?.message };
  }
}
