"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";

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
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error), data: [], unreadCount: 0 };
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
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to update notification") };
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
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to update notifications") };
  }
}
