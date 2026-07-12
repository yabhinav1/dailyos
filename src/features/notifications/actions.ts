"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getNotifications() {
  try {
    const userId = await getUserId();
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const unreadCount = notifications.filter((n: { read: boolean }) => !n.read).length;
    return { success: true, data: notifications, unreadCount };
  } catch (error: any) {
    return { success: false, message: error?.message, data: [], unreadCount: 0 };
  }
}

export async function markNotificationRead(id: string) {
  try {
    const userId = await getUserId();
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to update notification" };
  }
}

export async function markAllNotificationsRead() {
  try {
    const userId = await getUserId();
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to update notifications" };
  }
}
