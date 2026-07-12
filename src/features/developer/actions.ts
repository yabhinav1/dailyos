"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

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

export async function getCodingProjects() {
  try {
    const userId = await getUserId();
    const projects = await prisma.codingProject.findMany({
      where: { userId },
      include: {
        issues: true,
        changelogs: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return { success: true, data: projects };
  } catch (error: any) {
    return { success: false, message: error?.message };
  }
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
  } catch (error: any) {
    return { success: false, message: error?.message };
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
