"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getProjects as queryGetProjects,
  getProjectById as queryGetProjectById,
  getActiveProjectsList as queryGetActiveProjectsList
} from "./queries";
import { uploadFileToMongo, deleteFileFromMongo } from "@/lib/mongo-storage";
import { hardDeleteTrashed } from "@/lib/trash-purge";
import { getErrorMessage } from "@/lib/utils";

// Hard ceiling per file so a single upload can't exhaust a serverless
// function's memory while it buffers the file. Total storage still grows
// with however many MONGODB_URI_N clusters you configure — this cap is
// just a per-file sanity limit, not the pool's total capacity.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

// Validation Schemas
const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  deadline: z.string().nullable().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

const createMilestoneSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1, "Milestone title is required"),
  description: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

const createResourceSchema = z.object({
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  url: z.string().url("Invalid URL").or(z.literal("")).optional(),
  type: z.string().default("LINK"),
  content: z.string().optional(),
});

// Auth Helper
async function getUserIdOrThrow() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// -------------------------------------------------------------
// PROJECT CRUD ACTIONS
// -------------------------------------------------------------

export async function createProject(formData: z.infer<typeof createProjectSchema>) {
  const userId = await getUserIdOrThrow();
  const validated = createProjectSchema.parse(formData);

  const project = await prisma.project.create({
    data: {
      ...validated,
      userId,
      deadline: validated.deadline ? new Date(validated.deadline) : null,
    },
  });

  // Track activity history
  await prisma.activityHistory.create({
    data: {
      userId,
      action: "project_created",
      entityType: "PROJECT",
      entityId: project.id,
      details: `Created workspace "${project.name}"`,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/notes");
  return { success: true, data: project };
}

export async function updateProject(projectId: string, formData: z.infer<typeof updateProjectSchema>) {
  const userId = await getUserIdOrThrow();
  
  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!existing) {
    throw new Error("Project workspace not found or access denied.");
  }

  const validated = updateProjectSchema.parse(formData);

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...validated,
      deadline: validated.deadline ? new Date(validated.deadline) : validated.deadline === null ? null : undefined,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/notes");
  return { success: true, data: updatedProject };
}

// Soft Delete
export async function deleteProject(projectId: string) {
  const userId = await getUserIdOrThrow();

  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!existing) {
    throw new Error("Project workspace not found or access denied.");
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/projects");
  revalidatePath("/notes");
  return { success: true };
}

// Restore soft delete
export async function restoreProject(projectId: string) {
  const userId = await getUserIdOrThrow();

  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!existing) {
    throw new Error("Project workspace not found or access denied.");
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: null },
  });

  revalidatePath("/projects");
  revalidatePath("/notes");
  return { success: true };
}

// Hard delete from trash. Milestones cascade and tasks are unlinked
// (projectId SetNull), per the schema; files attached only to this project
// are removed from GridFS along with their rows.
export async function hardDeleteProject(projectId: string) {
  const userId = await getUserIdOrThrow();

  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId, deletedAt: { not: null } },
  });

  if (!existing) {
    throw new Error("Project workspace not found in trash or access denied.");
  }

  await hardDeleteTrashed({ projects: { id: projectId, userId } });

  revalidatePath("/projects");
  revalidatePath("/tasks");
  revalidatePath("/notes");
  return { success: true };
}

// Complete Project Toggle
export async function toggleProjectCompleted(projectId: string, isCompleted: boolean) {
  const userId = await getUserIdOrThrow();

  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!existing) {
    throw new Error("Project workspace not found or access denied.");
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { isCompleted },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true, data: updated };
}

// -------------------------------------------------------------
// MILESTONE ACTIONS
// -------------------------------------------------------------

export async function createMilestone(formData: z.infer<typeof createMilestoneSchema>) {
  const userId = await getUserIdOrThrow();
  const validated = createMilestoneSchema.parse(formData);

  // Validate ownership
  const project = await prisma.project.findFirst({
    where: { id: validated.projectId, userId },
  });

  if (!project) {
    throw new Error("Project not found or access denied.");
  }

  const milestone = await prisma.milestone.create({
    data: {
      ...validated,
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
    },
  });

  revalidatePath(`/dashboard/projects/${validated.projectId}`);
  return { success: true, data: milestone };
}

export async function toggleMilestoneCompleted(milestoneId: string, isCompleted: boolean) {
  const userId = await getUserIdOrThrow();

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { project: true },
  });

  if (!milestone || milestone.project.userId !== userId) {
    throw new Error("Milestone not found or access denied.");
  }

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { isCompleted },
  });

  revalidatePath(`/dashboard/projects/${milestone.projectId}`);
  return { success: true, data: updated };
}

export async function deleteMilestone(milestoneId: string) {
  const userId = await getUserIdOrThrow();

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { project: true },
  });

  if (!milestone || milestone.project.userId !== userId) {
    throw new Error("Milestone not found or access denied.");
  }

  await prisma.milestone.delete({
    where: { id: milestoneId },
  });

  revalidatePath(`/dashboard/projects/${milestone.projectId}`);
  return { success: true };
}

// -------------------------------------------------------------
// RESOURCE ACTIONS
// -------------------------------------------------------------

export async function createResource(formData: z.infer<typeof createResourceSchema>) {
  try {
    const userId = await getUserIdOrThrow();
    const validated = createResourceSchema.parse(formData);

    const resource = await prisma.resource.create({
      data: {
        ...validated,
        userId,
      },
    });

    if (validated.projectId) {
      revalidatePath(`/projects`);
    }
    return { success: true, data: resource };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to upload file") };
  }
}

/**
 * Uploads a file (e.g. a PDF) into GridFS-backed MongoDB storage — picked
 * automatically from whichever configured MONGODB_URI_N cluster has room —
 * and creates a Resource record pointing at it. Use this instead of
 * createResource for actual file attachments; createResource stays for
 * links/bookmarks/small text content.
 */
export async function uploadProjectFile(formData: FormData) {
  try {
    const userId = await getUserIdOrThrow();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, message: "No file was provided." };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return {
        success: false,
        message: `File is too large (max ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)}MB per file).`,
      };
    }

    const projectId = (formData.get("projectId") as string | null) || undefined;
    const taskId = (formData.get("taskId") as string | null) || undefined;
    const title = (formData.get("title") as string | null)?.trim() || file.name;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { mongoIndex, fileId } = await uploadFileToMongo(buffer, file.name, file.type || "application/octet-stream", {
      userId,
    });

    const resource = await prisma.resource.create({
      data: {
        userId,
        projectId,
        taskId,
        title,
        type: "FILE",
        mongoIndex,
        fileId,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      },
    });

    if (projectId) revalidatePath(`/projects`);
    return { success: true, data: resource };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to upload file.") };
  }
}

export async function deleteResource(resourceId: string) {
  try {
    const userId = await getUserIdOrThrow();

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource || resource.userId !== userId) {
      throw new Error("Resource not found or access denied.");
    }

    if (resource.type === "FILE" && resource.mongoIndex != null && resource.fileId) {
      await deleteFileFromMongo(resource.mongoIndex, resource.fileId);
    }

    await prisma.resource.delete({
      where: { id: resourceId },
    });

    if (resource.projectId) {
      revalidatePath(`/projects`);
    }
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to delete file") };
  }
}

export async function getResourcesForProject(projectId: string) {
  try {
    const userId = await getUserIdOrThrow();
    const resources = await prisma.resource.findMany({
      where: { projectId, userId, type: { in: ["ATTACHMENT", "FILE"] } },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: resources };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to load files"), data: [] };
  }
}

export async function getProjectsAction() {
  try {
    const data = await queryGetProjects();
    return { success: true, data };
  } catch (error: unknown) {
    console.error("getProjectsAction error:", error);
    return { success: false, message: getErrorMessage(error, "Failed to fetch projects") };
  }
}

export async function getProjectByIdAction(projectId: string) {
  try {
    const data = await queryGetProjectById(projectId);
    return { success: true, data };
  } catch (error: unknown) {
    console.error("getProjectByIdAction error:", error);
    return { success: false, message: getErrorMessage(error, "Failed to fetch project detail") };
  }
}

export async function getActiveProjectsListAction() {
  try {
    const data = await queryGetActiveProjectsList();
    return { success: true, data };
  } catch (error: unknown) {
    console.error("getActiveProjectsListAction error:", error);
    return { success: false, message: getErrorMessage(error, "Failed to fetch projects list") };
  }
}

