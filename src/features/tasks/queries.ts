import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma, Priority, TaskStatus } from "@prisma/client";

export interface TaskFilters {
  status?: TaskStatus;
  priority?: Priority;
  projectId?: string;
  categoryId?: string;
  isFavorite?: boolean;
  tag?: string;
  search?: string;
  sortBy?: "dueDate" | "priority" | "createdAt";
  sortOrder?: "asc" | "desc";
}

async function getUserIdOrThrow() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function getTasks(filters: TaskFilters = {}) {
  const userId = await getUserIdOrThrow();

  const whereClause: Prisma.TaskWhereInput = {
    userId,
    deletedAt: null, // Only fetch active tasks
  };

  if (filters.status) {
    whereClause.status = filters.status;
  }

  if (filters.priority) {
    whereClause.priority = filters.priority;
  }

  if (filters.projectId) {
    whereClause.projectId = filters.projectId;
  }

  if (filters.categoryId) {
    whereClause.categoryId = filters.categoryId;
  }

  if (filters.isFavorite !== undefined) {
    whereClause.isFavorite = filters.isFavorite;
  }

  if (filters.tag) {
    whereClause.tags = { some: { tag: { name: filters.tag } } };
  }

  if (filters.search) {
    whereClause.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const sortBy = filters.sortBy || "createdAt";
  const sortOrder = filters.sortOrder || "desc";
  const orderByClause: Prisma.TaskOrderByWithRelationInput = { [sortBy]: sortOrder };

  return prisma.task.findMany({
    where: whereClause,
    orderBy: orderByClause,
    include: {
      subtasks: true,
      checklists: true,
      category: true,
      project: true,
      goal: { select: { id: true, title: true } },
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });
}

export async function getTaskById(taskId: string) {
  const userId = await getUserIdOrThrow();

  return prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
    include: {
      subtasks: {
        orderBy: {
          createdAt: "asc",
        },
      },
      checklists: {
        orderBy: {
          order: "asc",
        },
      },
      category: true,
      project: true,
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });
}

export async function getDeletedTasks() {
  const userId = await getUserIdOrThrow();

  return prisma.task.findMany({
    where: {
      userId,
      deletedAt: {
        not: null,
      },
    },
    orderBy: {
      deletedAt: "desc",
    },
    include: {
      category: true,
      project: true,
    },
  });
}
