"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Priority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { createNotification } from "@/lib/notifications";
import { sendSharedEmail } from "@/lib/email";
import { assertInviteBudget } from "@/lib/invite-limit";
import { LINK_ACCESS, SHARE_ROLES, newShareToken, resolveProjectAccess, type LinkAccess } from "@/lib/note-access";
import { isDateKey, keyToUtcDate } from "@/lib/dates";
import { afterTaskChange } from "@/lib/task-effects";

async function getUserIdOrThrow() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

async function ownedProject(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId, deletedAt: null } });
  if (!project) throw new Error("Project not found or access denied.");
  return project;
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const linkFor = (token: string) => `${appUrl()}/p/${token}`;

function revalidateProjectViews() {
  revalidatePath("/projects");
  revalidatePath("/tasks");
  revalidatePath("/today");
}

// -------------------------------------------------------------
// Owner: who can see the project
// -------------------------------------------------------------

export async function getProjectShareSettingsAction(projectId: string) {
  try {
    const userId = await getUserIdOrThrow();
    let project = await ownedProject(projectId, userId);
    if (!project.shareToken) {
      project = await prisma.project.update({ where: { id: projectId }, data: { shareToken: newShareToken() } });
    }
    const shares = await prisma.projectShare.findMany({
      where: { projectId },
      select: { id: true, email: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      success: true,
      data: { link: linkFor(project.shareToken!), linkAccess: project.linkAccess as LinkAccess, shares },
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to load sharing") };
  }
}

export async function setProjectLinkAccessAction(projectId: string, access: LinkAccess) {
  const userId = await getUserIdOrThrow();
  await ownedProject(projectId, userId);
  const linkAccess = z.enum(LINK_ACCESS as [LinkAccess, ...LinkAccess[]]).parse(access);
  await prisma.project.update({ where: { id: projectId }, data: { linkAccess } });
  revalidatePath("/projects");
  return { success: true };
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.enum(SHARE_ROLES),
});

export async function inviteToProjectAction(projectId: string, email: string, role: "VIEW" | "EDIT") {
  try {
    const userId = await getUserIdOrThrow();
    const project = await ownedProject(projectId, userId);
    const input = inviteSchema.parse({ email, role });

    const owner = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (owner?.email.toLowerCase() === input.email) throw new Error("That's your own address — you already own this project.");

    const existing = await prisma.projectShare.findUnique({
      where: { projectId_email: { projectId, email: input.email } },
    });
    if (!existing) {
      const count = await prisma.projectShare.count({ where: { projectId } });
      if (count >= 50) throw new Error("A project can be shared with at most 50 people.");
      await assertInviteBudget(userId);
    }

    const token = project.shareToken ?? newShareToken();
    if (!project.shareToken) await prisma.project.update({ where: { id: projectId }, data: { shareToken: token } });

    const share = await prisma.projectShare.upsert({
      where: { projectId_email: { projectId, email: input.email } },
      update: { role: input.role },
      create: { projectId, email: input.email, role: input.role },
      select: { id: true, email: true, role: true },
    });

    if (!existing) {
      const sharedBy = owner?.name || owner?.email || "Someone";
      const invitee = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (invitee) {
        await createNotification(invitee.id, "Project shared with you", `${sharedBy} shared "${project.name}"`, "INFO");
      }
      try {
        await sendSharedEmail(input.email, sharedBy, project.name, input.role, linkFor(token), "project");
      } catch (err) {
        console.error("[share] project invite email failed:", err);
      }
    }

    revalidatePath("/projects");
    return { success: true, data: share };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to share project") };
  }
}

export async function removeProjectShareAction(shareId: string) {
  const userId = await getUserIdOrThrow();
  const share = await prisma.projectShare.findFirst({ where: { id: shareId, project: { userId } }, select: { id: true } });
  if (!share) throw new Error("Not found or access denied.");
  await prisma.projectShare.delete({ where: { id: shareId } });
  revalidatePath("/projects");
  return { success: true };
}

export async function resetProjectShareLinkAction(projectId: string) {
  const userId = await getUserIdOrThrow();
  await ownedProject(projectId, userId);
  const project = await prisma.project.update({ where: { id: projectId }, data: { shareToken: newShareToken() } });
  return { success: true, data: { link: linkFor(project.shareToken!) } };
}

export async function getProjectsSharedWithMeAction() {
  try {
    const userId = await getUserIdOrThrow();
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!me) throw new Error("Unauthorized");
    const shares = await prisma.projectShare.findMany({
      where: { email: me.email.toLowerCase(), project: { deletedAt: null, NOT: { userId } } },
      select: {
        role: true,
        project: {
          select: {
            name: true,
            shareToken: true,
            isCompleted: true,
            user: { select: { name: true, email: true } },
            _count: { select: { tasks: { where: { deletedAt: null } } } },
          },
        },
      },
      orderBy: { project: { updatedAt: "desc" } },
    });
    return {
      success: true,
      data: shares
        .filter((s) => s.project.shareToken)
        .map((s) => ({
          token: s.project.shareToken!,
          name: s.project.name,
          role: s.role,
          owner: s.project.user.name || s.project.user.email,
          isCompleted: s.project.isCompleted,
          taskCount: s.project._count.tasks,
        })),
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error), data: [] };
  }
}

// -------------------------------------------------------------
// Anyone with access: the project through its link
// -------------------------------------------------------------

/** The project, its milestones and tasks, as the caller may see them. */
export async function getSharedProjectAction(token: string) {
  try {
    const access = await resolveProjectAccess(token);
    if (access.status !== "ok") return { success: false as const, status: access.status };
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: access.projectId },
      select: {
        id: true,
        name: true,
        description: true,
        deadline: true,
        isCompleted: true,
        user: { select: { name: true, email: true } },
        milestones: {
          orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
          select: { id: true, title: true, dueDate: true, isCompleted: true },
        },
        tasks: {
          where: { deletedAt: null },
          orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            _count: { select: { subtasks: true } },
          },
        },
      },
    });
    return {
      success: true as const,
      data: {
        ...project,
        owner: project.user.name || project.user.email,
        role: access.role,
        signedIn: access.userId !== null,
      },
    };
  } catch (error: unknown) {
    return { success: false as const, status: "error" as const, message: getErrorMessage(error) };
  }
}

/** Editors and the owner only. Returns the project's owner for side effects. */
async function requireEditor(token: string) {
  const access = await resolveProjectAccess(token);
  if (access.status !== "ok") throw new Error("You no longer have access to this project.");
  if (access.role === "VIEW") throw new Error("You can only view this project.");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: access.projectId }, select: { userId: true } });
  return { projectId: access.projectId, ownerId: project.userId, actor: access.displayName };
}

export async function setSharedTaskDoneAction(token: string, taskId: string, done: boolean) {
  try {
    const { projectId, ownerId, actor } = await requireEditor(token);
    const before = await prisma.task.findFirst({ where: { id: taskId, projectId, deletedAt: null } });
    if (!before) throw new Error("Task not found in this project.");
    const after = await prisma.task.update({
      where: { id: taskId },
      data: { status: done ? TaskStatus.COMPLETED : TaskStatus.TODO },
    });
    await afterTaskChange(ownerId, before, after);
    await prisma.activityHistory.create({
      data: {
        userId: ownerId,
        action: done ? "task_completed" : "task_reopened",
        entityType: "TASK",
        entityId: taskId,
        details: `${actor} ${done ? "completed" : "reopened"} "${before.title}" via share link`,
      },
    });
    revalidateProjectViews();
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Couldn't update the task") };
  }
}

export async function setSharedMilestoneDoneAction(token: string, milestoneId: string, done: boolean) {
  try {
    const { projectId } = await requireEditor(token);
    const result = await prisma.milestone.updateMany({ where: { id: milestoneId, projectId }, data: { isCompleted: done } });
    if (result.count === 0) throw new Error("Milestone not found in this project.");
    revalidateProjectViews();
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Couldn't update the milestone") };
  }
}

const sharedTaskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  dueDate: z.string().refine(isDateKey).nullish(),
  priority: z.nativeEnum(Priority).optional(),
});

/** Adds a task to the project. It belongs to the owner, like everything in it. */
export async function addSharedTaskAction(token: string, input: z.input<typeof sharedTaskSchema>) {
  try {
    const { projectId, ownerId, actor } = await requireEditor(token);
    const data = sharedTaskSchema.parse(input);
    const task = await prisma.task.create({
      data: {
        userId: ownerId,
        projectId,
        title: data.title,
        priority: data.priority ?? Priority.MEDIUM,
        dueDate: data.dueDate ? keyToUtcDate(data.dueDate) : null,
        actualTime: 0,
      },
    });
    await prisma.activityHistory.create({
      data: {
        userId: ownerId,
        action: "task_created",
        entityType: "TASK",
        entityId: task.id,
        details: `${actor} added "${task.title}" via share link`,
      },
    });
    revalidateProjectViews();
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Couldn't add the task") };
  }
}
