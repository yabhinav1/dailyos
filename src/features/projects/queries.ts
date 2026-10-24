import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { TaskStatus } from "@prisma/client";

async function getUserIdOrThrow() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function getProjects() {
  const userId = await getUserIdOrThrow();

  const projects = await prisma.project.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    include: {
      tasks: {
        where: {
          deletedAt: null,
        },
        select: {
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Dynamically calculate progress for each project
  return projects.map((project) => {
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(
      (task) => task.status === TaskStatus.COMPLETED
    ).length;

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      ...project,
      progress,
      totalTasks,
      completedTasks,
    };
  });
}

export async function getProjectById(projectId: string) {
  const userId = await getUserIdOrThrow();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
      deletedAt: null,
    },
    include: {
      tasks: {
        where: {
          deletedAt: null,
        },
        include: {
          subtasks: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      milestones: {
        orderBy: {
          dueDate: "asc",
        },
      },
      resources: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!project) return null;

  // Calculate progress
  const totalTasks = project.tasks.length;
  const completedTasks = project.tasks.filter(
    (task) => task.status === TaskStatus.COMPLETED
  ).length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    ...project,
    progress,
    totalTasks,
    completedTasks,
  };
}

export async function getActiveProjectsList() {
  const userId = await getUserIdOrThrow();

  return prisma.project.findMany({
    where: {
      userId,
      deletedAt: null,
      isCompleted: false,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function getDeletedProjects() {
  const userId = await getUserIdOrThrow();

  return prisma.project.findMany({
    where: {
      userId,
      deletedAt: {
        not: null,
      },
    },
    orderBy: {
      deletedAt: "desc",
    },
    select: {
      id: true,
      name: true,
      description: true,
      deletedAt: true,
      _count: {
        select: {
          // Live tasks are unlinked, not deleted, when the project goes.
          tasks: { where: { deletedAt: null } },
          // Attached to the project alone, so deleted along with it.
          resources: { where: { taskId: null } },
        },
      },
    },
  });
}
