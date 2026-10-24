"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// ── Coding Projects ──
const codingProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  githubUrl: z.string().url().optional().or(z.literal("")),
  techStack: z.array(z.string()).default([]),
  status: z.enum(["PLANNING", "ACTIVE", "COMPLETED", "ON_HOLD"]).default("PLANNING"),
  roadmap: z.string().optional(),
});

export async function createCodingProject(data: z.infer<typeof codingProjectSchema>) {
  const userId = await getUserId();
  const validated = codingProjectSchema.parse(data);
  const project = await prisma.codingProject.create({
    data: {
      ...validated,
      userId,
      githubUrl: validated.githubUrl || null,
      roadmap: validated.roadmap || null,
    },
  });
  revalidatePath("/developer");
  return { success: true, data: project };
}

export async function updateCodingProject(projectId: string, data: z.infer<typeof codingProjectSchema>) {
  const userId = await getUserId();
  const validated = codingProjectSchema.parse(data);
  // userId in the where clause doubles as the ownership check: someone else's
  // project matches nothing and the update throws.
  const project = await prisma.codingProject.update({
    where: { id: projectId, userId },
    data: {
      ...validated,
      // An emptied field should clear the column, not store "".
      description: validated.description || null,
      githubUrl: validated.githubUrl || null,
      roadmap: validated.roadmap || null,
    },
  });
  revalidatePath("/developer");
  return { success: true, data: project };
}

export async function deleteCodingProject(projectId: string) {
  const userId = await getUserId();
  // Issues and changelogs go with it (onDelete: Cascade).
  await prisma.codingProject.delete({
    where: { id: projectId, userId },
  });
  revalidatePath("/developer");
  return { success: true };
}

export async function getCodingProjects() {
  try {
    const userId = await getUserId();
    const projects = await prisma.codingProject.findMany({
      where: { userId },
      include: {
        issues: { orderBy: { createdAt: "desc" } },
        changelogs: { orderBy: { releasedAt: "desc" } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return { success: true, data: projects };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/** Throws unless the coding project exists and belongs to the user. */
async function assertProjectOwner(projectId: string, userId: string) {
  const project = await prisma.codingProject.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error("Project not found.");
}

// ── Issues ──
const issueType = z.enum(["BUG", "FEATURE", "CHORE"]);
const issueStatus = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
const issuePriority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const issueSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: issueType.default("BUG"),
  status: issueStatus.default("OPEN"),
  priority: issuePriority.default("MEDIUM"),
});

// No defaults here: zod fills defaults into missing keys, which would quietly
// reset fields that a partial update (e.g. a status change) never sent.
const issueUpdateSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  type: issueType,
  status: issueStatus,
  priority: issuePriority,
}).partial();

export async function createIssue(projectId: string, data: z.infer<typeof issueSchema>) {
  const userId = await getUserId();
  const validated = issueSchema.parse(data);
  await assertProjectOwner(projectId, userId);
  const issue = await prisma.developerIssue.create({
    data: {
      ...validated,
      codingProjectId: projectId,
      description: validated.description || null,
    },
  });
  revalidatePath("/developer");
  return { success: true, data: issue };
}

export async function updateIssue(issueId: string, data: z.infer<typeof issueUpdateSchema>) {
  const userId = await getUserId();
  const validated = issueUpdateSchema.parse(data);
  // Issues have no userId of their own — ownership runs through the project.
  const existing = await prisma.developerIssue.findFirst({
    where: { id: issueId, codingProject: { userId } },
  });
  if (!existing) throw new Error("Issue not found.");
  const issue = await prisma.developerIssue.update({
    where: { id: issueId },
    data: {
      ...validated,
      ...(validated.description !== undefined && { description: validated.description || null }),
    },
  });
  revalidatePath("/developer");
  return { success: true, data: issue };
}

export async function deleteIssue(issueId: string) {
  const userId = await getUserId();
  const existing = await prisma.developerIssue.findFirst({
    where: { id: issueId, codingProject: { userId } },
  });
  if (!existing) throw new Error("Issue not found.");
  await prisma.developerIssue.delete({ where: { id: issueId } });
  revalidatePath("/developer");
  return { success: true };
}

// ── Changelogs ──
const changelogSchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

export async function createChangelog(projectId: string, data: z.infer<typeof changelogSchema>) {
  const userId = await getUserId();
  const validated = changelogSchema.parse(data);
  await assertProjectOwner(projectId, userId);
  const changelog = await prisma.changelog.create({
    data: {
      ...validated,
      codingProjectId: projectId,
      description: validated.description || null,
    },
  });
  revalidatePath("/developer");
  return { success: true, data: changelog };
}

export async function deleteChangelog(changelogId: string) {
  const userId = await getUserId();
  const existing = await prisma.changelog.findFirst({
    where: { id: changelogId, codingProject: { userId } },
  });
  if (!existing) throw new Error("Release not found.");
  await prisma.changelog.delete({ where: { id: changelogId } });
  revalidatePath("/developer");
  return { success: true };
}

// ── Code Snippets ──
const snippetSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  code: z.string().min(1),
  language: z.string().min(1),
});

export async function createSnippet(data: z.infer<typeof snippetSchema>) {
  const userId = await getUserId();
  const validated = snippetSchema.parse(data);
  const snippet = await prisma.codeSnippet.create({
    data: {
      ...validated,
      userId,
    },
  });
  revalidatePath("/developer");
  return { success: true, data: snippet };
}

export async function getSnippets() {
  try {
    const userId = await getUserId();
    const snippets = await prisma.codeSnippet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: snippets };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function deleteSnippet(snippetId: string) {
  const userId = await getUserId();
  await prisma.codeSnippet.delete({
    where: { id: snippetId, userId },
  });
  revalidatePath("/developer");
  return { success: true };
}
