import { prisma } from "@/lib/prisma";

/**
 * Recomputes a goal's progress from its linked tasks: the share of live
 * (not trashed) linked tasks that are completed. A goal with no linked tasks
 * keeps its manually set progress untouched.
 */
export async function syncGoalProgress(goalId: string | null | undefined) {
  if (!goalId) return;

  const [total, completed] = await Promise.all([
    prisma.task.count({ where: { goalId, deletedAt: null } }),
    prisma.task.count({ where: { goalId, deletedAt: null, status: "COMPLETED" } }),
  ]);
  if (total === 0) return;

  const progress = Math.round((completed / total) * 100);
  await prisma.goal.update({
    where: { id: goalId },
    data: { progress, isCompleted: progress >= 100 },
  });
}
