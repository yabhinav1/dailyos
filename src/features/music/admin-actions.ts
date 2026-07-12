"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { checkLavalinkNode } from "@/lib/music/lavalink-manager";

export async function listLavalinkNodes() {
  try {
    await requireAdmin();
    const nodes = await prisma.lavalinkNode.findMany({
      orderBy: { priority: "asc" },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        enabled: true,
        priority: true,
        status: true,
        lastError: true,
        lastCheckedAt: true,
        createdAt: true,
        // password intentionally excluded — never sent to the client
      },
    });
    return { success: true, data: nodes };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to load nodes", data: [] };
  }
}

export async function addLavalinkNode(input: {
  name: string;
  host: string;
  port: number;
  password: string;
  secure: boolean;
  priority?: number;
}) {
  try {
    const admin = await requireAdmin();

    if (!input.name?.trim() || !input.host?.trim() || !input.password) {
      return { success: false, message: "Name, host, and password are required." };
    }
    if (!Number.isInteger(input.port) || input.port <= 0 || input.port > 65535) {
      return { success: false, message: "Port must be a valid number between 1 and 65535." };
    }

    const node = await prisma.lavalinkNode.create({
      data: {
        name: input.name.trim(),
        host: input.host.trim(),
        port: input.port,
        password: input.password,
        secure: !!input.secure,
        priority: input.priority ?? 0,
        createdById: admin.id!,
      },
    });

    // Verify it immediately so the admin gets instant feedback instead of
    // waiting for the next health-check cycle.
    const check = await checkLavalinkNode({
      id: node.id,
      name: node.name,
      host: node.host,
      port: node.port,
      password: node.password,
      secure: node.secure,
      priority: node.priority,
    });
    await prisma.lavalinkNode.update({
      where: { id: node.id },
      data: { status: check.status, lastError: check.error ?? null, lastCheckedAt: new Date() },
    });

    revalidatePath("/admin/music");
    return { success: true, data: { id: node.id }, checkResult: check };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to add node" };
  }
}

export async function updateLavalinkNode(
  id: string,
  input: Partial<{ name: string; host: string; port: number; password: string; secure: boolean; enabled: boolean; priority: number }>
) {
  try {
    await requireAdmin();
    await prisma.lavalinkNode.update({
      where: { id },
      data: input,
    });
    revalidatePath("/admin/music");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to update node" };
  }
}

export async function removeLavalinkNode(id: string) {
  try {
    await requireAdmin();
    await prisma.lavalinkNode.delete({ where: { id } });
    revalidatePath("/admin/music");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to remove node" };
  }
}

export async function testLavalinkNode(id: string) {
  try {
    await requireAdmin();
    const node = await prisma.lavalinkNode.findUnique({ where: { id } });
    if (!node) return { success: false, message: "Node not found" };

    const result = await checkLavalinkNode({
      id: node.id,
      name: node.name,
      host: node.host,
      port: node.port,
      password: node.password,
      secure: node.secure,
      priority: node.priority,
    });

    await prisma.lavalinkNode.update({
      where: { id },
      data: { status: result.status, lastError: result.error ?? null, lastCheckedAt: new Date() },
    });

    revalidatePath("/admin/music");
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to test node" };
  }
}
