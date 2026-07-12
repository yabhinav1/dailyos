import { prisma } from "@/lib/prisma";

export type NotificationType = "INFO" | "WARNING" | "SUCCESS" | "CALENDAR" | "TASK";

/**
 * Creates an in-app notification for a user (shows up in the bell dropdown).
 * Swallows errors so a notification failure never breaks the calling action.
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType = "INFO"
) {
  try {
    await prisma.notification.create({
      data: { userId, title, message, type },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}
