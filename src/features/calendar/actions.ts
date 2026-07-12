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

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  isAllDay: z.boolean().default(false),
  color: z.string().optional(),
});

export async function createEvent(data: z.infer<typeof eventSchema>) {
  const userId = await getUserId();
  const validated = eventSchema.parse(data);
  const event = await prisma.calendarEvent.create({
    data: {
      ...validated,
      userId,
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate),
    },
  });
  revalidatePath("/calendar");
  return { success: true, data: event };
}

export async function updateEvent(eventId: string, data: Partial<z.infer<typeof eventSchema>>) {
  const userId = await getUserId();
  const existing = await prisma.calendarEvent.findFirst({ where: { id: eventId, userId } });
  if (!existing) throw new Error("Event not found.");

  const updateData: any = { ...data };
  if (data.startDate) updateData.startDate = new Date(data.startDate);
  if (data.endDate) updateData.endDate = new Date(data.endDate);

  await prisma.calendarEvent.update({ where: { id: eventId }, data: updateData });
  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteEvent(eventId: string) {
  const userId = await getUserId();
  const existing = await prisma.calendarEvent.findFirst({ where: { id: eventId, userId } });
  if (!existing) throw new Error("Event not found.");
  await prisma.calendarEvent.delete({ where: { id: eventId } });
  revalidatePath("/calendar");
  return { success: true };
}

export async function getEventsAction(year: number, month: number) {
  try {
    const userId = await getUserId();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId,
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
      },
      orderBy: { startDate: "asc" },
    });

    return { success: true, data: events };
  } catch (error: any) {
    return { success: false, message: error?.message };
  }
}
