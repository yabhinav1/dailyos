import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RECURRENCES, keyToUtcDate, nextDueAfterCompletion, utcDateToKey } from "@/lib/dates";
import { getUserToday } from "@/lib/user-time";
import { syncGoalProgress } from "@/lib/goal-progress";

// Kept out of the "use server" actions file: everything exported from there
// becomes a callable endpoint, and these must only run after an access check.

/**
 * Called when a recurring task becomes COMPLETED: creates the next occurrence
 * with the same details and a fresh checklist. Skips if that occurrence
 * already exists, so un-ticking and re-ticking doesn't stack duplicates.
 */
export async function spawnNextOccurrence(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { subtasks: true, checklists: true, tags: true },
  });
  const rule = RECURRENCES.find((r) => r === task?.recurrence);
  if (!task || !rule) return;

  const today = await getUserToday(userId);
  const nextKey = nextDueAfterCompletion(task.dueDate ? utcDateToKey(task.dueDate) : null, rule, today);
  const dueDate = keyToUtcDate(nextKey);

  const existing = await prisma.task.findFirst({
    where: { userId, title: task.title, recurrence: rule, dueDate, deletedAt: null },
    select: { id: true },
  });
  if (existing) return;

  await prisma.task.create({
    data: {
      userId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: TaskStatus.TODO,
      dueDate,
      dueTime: task.dueTime,
      estimatedTime: task.estimatedTime,
      projectId: task.projectId,
      categoryId: task.categoryId,
      goalId: task.goalId,
      recurrence: rule,
      subtasks: { create: task.subtasks.map((s) => ({ title: s.title })) },
      checklists: { create: task.checklists.map((c) => ({ title: c.title, order: c.order })) },
      tags: { create: task.tags.map((t) => ({ tagId: t.tagId })) },
    },
  });
}

/** Side effects of a task's status or goal changing. */
export async function afterTaskChange(
  userId: string,
  before: { id: string; status: TaskStatus; goalId: string | null },
  after: { status: TaskStatus; goalId: string | null }
) {
  if (before.status !== TaskStatus.COMPLETED && after.status === TaskStatus.COMPLETED) {
    await spawnNextOccurrence(before.id, userId);
  }
  await syncGoalProgress(after.goalId);
  if (before.goalId !== after.goalId) await syncGoalProgress(before.goalId);
}
