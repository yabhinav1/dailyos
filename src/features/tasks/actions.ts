"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Priority, TaskStatus } from "@prisma/client";
import { getTasks as queryGetTasks, type TaskFilters } from "./queries";
import { getErrorMessage } from "@/lib/utils";
import { hardDeleteTrashed } from "@/lib/trash-purge";
import { RECURRENCES, isDateKey, keyToUtcDate, nextDueAfterCompletion, utcDateToKey } from "@/lib/dates";
import { getUserToday } from "@/lib/user-time";
import { syncGoalProgress } from "@/lib/goal-progress";

// Fields shared by create and update, with no defaults: zod 4 fills defaults
// in even under .partial(), so a status-only update (ticking a task, a
// kanban drop) used to reset the task's priority to MEDIUM.
const taskFields = {
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.nativeEnum(Priority),
  status: z.nativeEnum(TaskStatus),
  dueDate: z.string().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  estimatedTime: z.number().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
  recurrence: z.enum(RECURRENCES).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
};

const createTaskSchema = z.object({
  ...taskFields,
  priority: taskFields.priority.default(Priority.MEDIUM),
  status: taskFields.status.default(TaskStatus.TODO),
});

const updateTaskSchema = z.object(taskFields).partial().extend({
  actualTime: z.number().optional(),
  isFavorite: z.boolean().optional(),
});

/** A due date arrives as YYYY-MM-DD and is stored as UTC midnight of that day. */
function parseDueDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (!value) return null;
  return isDateKey(value) ? keyToUtcDate(value) : new Date(value);
}

/**
 * Project, category and goal ids come from the client, so each one must be
 * the user's own — otherwise a task could be attached to (and so reveal or
 * skew) someone else's project or goal.
 */
async function assertOwnedRefs(
  userId: string,
  refs: { projectId?: string | null; categoryId?: string | null; goalId?: string | null }
) {
  const checks: Promise<unknown>[] = [];
  if (refs.projectId) checks.push(prisma.project.findFirstOrThrow({ where: { id: refs.projectId, userId } }));
  if (refs.categoryId) checks.push(prisma.category.findFirstOrThrow({ where: { id: refs.categoryId, userId } }));
  if (refs.goalId) checks.push(prisma.goal.findFirstOrThrow({ where: { id: refs.goalId, userId } }));
  try {
    await Promise.all(checks);
  } catch {
    throw new Error("Linked project, category or goal not found.");
  }
}

/** Replaces a task's tags, creating any tag names the user hasn't used yet. */
async function setTaskTags(userId: string, taskId: string, names: string[]) {
  const unique = [...new Map(names.map((n) => [n.toLowerCase(), n])).values()];
  const tags = await Promise.all(
    unique.map((name) =>
      prisma.tag.upsert({
        where: { userId_name: { userId, name } },
        update: {},
        create: { userId, name },
      })
    )
  );
  await prisma.$transaction([
    prisma.taskTag.deleteMany({ where: { taskId } }),
    prisma.taskTag.createMany({ data: tags.map((t) => ({ taskId, tagId: t.id })), skipDuplicates: true }),
  ]);
}

/**
 * Called when a recurring task becomes COMPLETED: creates the next occurrence
 * with the same details and a fresh checklist. Skips if that occurrence
 * already exists, so un-ticking and re-ticking doesn't stack duplicates.
 */
async function spawnNextOccurrence(taskId: string, userId: string) {
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
async function afterTaskChange(
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

function revalidateTaskViews() {
  revalidatePath("/tasks");
  revalidatePath("/notes");
  revalidatePath("/today");
  revalidatePath("/goals");
}

// Helper helper to get authenticated user ID
async function getUserIdOrThrow() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// -------------------------------------------------------------
// TASK ACTIONS
// -------------------------------------------------------------

export async function createTask(formData: z.infer<typeof createTaskSchema>) {
  const userId = await getUserIdOrThrow();
  const { tags, ...validated } = createTaskSchema.parse(formData);
  await assertOwnedRefs(userId, validated);

  const task = await prisma.task.create({
    data: {
      ...validated,
      userId,
      dueDate: parseDueDate(validated.dueDate) ?? null,
      actualTime: 0,
    },
  });
  if (tags?.length) await setTaskTags(userId, task.id, tags);

  // Track activity history
  await prisma.activityHistory.create({
    data: {
      userId,
      action: "task_created",
      entityType: "TASK",
      entityId: task.id,
      details: `Created task "${task.title}"`,
    },
  });

  if (task.status === TaskStatus.COMPLETED) await spawnNextOccurrence(task.id, userId);
  await syncGoalProgress(task.goalId);

  revalidateTaskViews();
  return { success: true, data: task };
}

export async function updateTask(taskId: string, formData: z.infer<typeof updateTaskSchema>) {
  const userId = await getUserIdOrThrow();
  
  // Ensure the task belongs to the user
  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });

  if (!existing) {
    throw new Error("Task not found or access denied.");
  }

  const { tags, ...data } = updateTaskSchema.parse(formData);
  await assertOwnedRefs(userId, data);

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...data,
      dueDate: parseDueDate(data.dueDate),
    },
  });
  if (tags) await setTaskTags(userId, taskId, tags);

  await afterTaskChange(userId, existing, updatedTask);

  revalidateTaskViews();
  return { success: true, data: updatedTask };
}

// Soft delete
export async function deleteTask(taskId: string) {
  const userId = await getUserIdOrThrow();

  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });

  if (!existing) {
    throw new Error("Task not found or access denied.");
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });
  await syncGoalProgress(existing.goalId);

  revalidateTaskViews();
  return { success: true };
}

// Restore soft delete
export async function restoreTask(taskId: string) {
  const userId = await getUserIdOrThrow();

  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });

  if (!existing) {
    throw new Error("Task not found or access denied.");
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: null },
  });
  await syncGoalProgress(existing.goalId);

  revalidateTaskViews();
  return { success: true };
}

// Hard delete from trash. Only a task already in the trash qualifies, and
// files attached only to it are removed from GridFS along with their rows.
export async function hardDeleteTask(taskId: string) {
  const userId = await getUserIdOrThrow();

  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId, deletedAt: { not: null } },
  });

  if (!existing) {
    throw new Error("Task not found in trash or access denied.");
  }

  await hardDeleteTrashed({ tasks: { id: taskId, userId } });

  revalidatePath("/tasks");
  revalidatePath("/notes");
  return { success: true };
}

export async function toggleTaskFavorite(taskId: string, isFavorite: boolean) {
  const userId = await getUserIdOrThrow();

  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });

  if (!existing) {
    throw new Error("Task not found or access denied.");
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { isFavorite },
  });

  revalidatePath("/tasks");
  return { success: true };
}

// -------------------------------------------------------------
// SUBTASK ACTIONS
// -------------------------------------------------------------

export async function createSubtask(taskId: string, title: string) {
  const userId = await getUserIdOrThrow();

  // Validate task belongs to user
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });

  if (!task) {
    throw new Error("Task not found or access denied.");
  }

  const subtask = await prisma.subtask.create({
    data: {
      taskId,
      title,
      isCompleted: false,
    },
  });

  revalidatePath("/tasks");
  return { success: true, data: subtask };
}

export async function toggleSubtask(subtaskId: string, isCompleted: boolean) {
  const userId = await getUserIdOrThrow();

  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    include: { task: true },
  });

  if (!subtask || subtask.task.userId !== userId) {
    throw new Error("Subtask not found or access denied.");
  }

  const updated = await prisma.subtask.update({
    where: { id: subtaskId },
    data: { isCompleted },
  });

  revalidatePath("/tasks");
  return { success: true, data: updated };
}

export async function deleteSubtask(subtaskId: string) {
  const userId = await getUserIdOrThrow();

  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    include: { task: true },
  });

  if (!subtask || subtask.task.userId !== userId) {
    throw new Error("Subtask not found or access denied.");
  }

  await prisma.subtask.delete({
    where: { id: subtaskId },
  });

  revalidatePath("/tasks");
  return { success: true };
}

// -------------------------------------------------------------
// CHECKLIST ACTIONS
// -------------------------------------------------------------

export async function createChecklistItem(taskId: string, title: string) {
  const userId = await getUserIdOrThrow();

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });

  if (!task) {
    throw new Error("Task not found or access denied.");
  }

  const item = await prisma.checklistItem.create({
    data: {
      taskId,
      title,
      isCompleted: false,
    },
  });

  revalidatePath("/tasks");
  return { success: true, data: item };
}

export async function toggleChecklistItem(itemId: string, isCompleted: boolean) {
  const userId = await getUserIdOrThrow();

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { task: true },
  });

  if (!item || item.task.userId !== userId) {
    throw new Error("Checklist item not found or access denied.");
  }

  const updated = await prisma.checklistItem.update({
    where: { id: itemId },
    data: { isCompleted },
  });

  revalidatePath("/tasks");
  return { success: true, data: updated };
}

export async function deleteChecklistItem(itemId: string) {
  const userId = await getUserIdOrThrow();

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { task: true },
  });

  if (!item || item.task.userId !== userId) {
    throw new Error("Checklist item not found or access denied.");
  }

  await prisma.checklistItem.delete({
    where: { id: itemId },
  });

  revalidatePath("/tasks");
  return { success: true };
}

export async function getTasksAction(filters: TaskFilters) {
  try {
    const data = await queryGetTasks(filters);
    return { success: true, data };
  } catch (error: unknown) {
    console.error("getTasksAction error:", error);
    return { success: false, message: getErrorMessage(error, "Failed to fetch tasks") };
  }
}

export async function toggleTaskCompleted(taskId: string, isCompleted: boolean) {
  const userId = await getUserIdOrThrow();

  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });

  if (!existing) {
    throw new Error("Task not found or access denied.");
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: isCompleted ? TaskStatus.COMPLETED : TaskStatus.TODO,
    },
  });
  await afterTaskChange(userId, existing, updated);

  revalidateTaskViews();
  return { success: true };
}

// -------------------------------------------------------------
// TASK DETAILS: comments and the data the details dialog needs
// -------------------------------------------------------------

const commentSchema = z.string().trim().min(1, "Comment is empty").max(5000);

/** Subtasks, checklist and comments for one task, for the details dialog. */
export async function getTaskDetailsAction(taskId: string) {
  try {
    const userId = await getUserIdOrThrow();
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
      select: {
        id: true,
        subtasks: { orderBy: { createdAt: "asc" } },
        notes: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!task) throw new Error("Task not found.");
    return { success: true, data: task };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to load task details") };
  }
}

export async function addTaskComment(taskId: string, content: string) {
  const userId = await getUserIdOrThrow();
  const text = commentSchema.parse(content);
  const task = await prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true } });
  if (!task) throw new Error("Task not found or access denied.");

  const comment = await prisma.taskNote.create({ data: { taskId, content: text } });
  revalidatePath("/tasks");
  return { success: true, data: comment };
}

export async function deleteTaskComment(commentId: string) {
  const userId = await getUserIdOrThrow();
  const comment = await prisma.taskNote.findFirst({
    where: { id: commentId, task: { userId } },
    select: { id: true },
  });
  if (!comment) throw new Error("Comment not found or access denied.");

  await prisma.taskNote.delete({ where: { id: commentId } });
  revalidatePath("/tasks");
  return { success: true };
}

/** The user's tag names, for suggestions in the task form and the filter. */
export async function getTagsAction() {
  try {
    const userId = await getUserIdOrThrow();
    const tags = await prisma.tag.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: tags };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to load tags") };
  }
}

