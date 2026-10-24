"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Priority, TaskStatus } from "@prisma/client";
import { getTasks as queryGetTasks, type TaskFilters } from "./queries";
import { getErrorMessage } from "@/lib/utils";
import { hardDeleteTrashed } from "@/lib/trash-purge";

// Zod schemas for input validation
const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  dueDate: z.string().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  estimatedTime: z.number().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
});

const updateTaskSchema = createTaskSchema.partial().extend({
  actualTime: z.number().optional(),
  isFavorite: z.boolean().optional(),
});

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
  const validated = createTaskSchema.parse(formData);

  const task = await prisma.task.create({
    data: {
      ...validated,
      userId,
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      actualTime: 0,
    },
  });

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

  revalidatePath("/tasks");
  revalidatePath("/notes");
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

  const data = updateTaskSchema.parse(formData);

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/notes");
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

  revalidatePath("/tasks");
  revalidatePath("/notes");
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

  revalidatePath("/tasks");
  revalidatePath("/notes");
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

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: isCompleted ? TaskStatus.COMPLETED : TaskStatus.TODO,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/notes");
  return { success: true };
}

