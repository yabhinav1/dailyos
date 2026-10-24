"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/utils";
import { RECURRENCES, isDateKey, isValidTimezone, keyToUtcDate } from "@/lib/dates";
import { listEventOccurrences } from "@/lib/events";
import { getUserTimezone } from "@/lib/user-time";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// Start and end arrive as full ISO instants built in the browser. They used
// to be "2026-10-24T09:00:00" with no zone, which the server (UTC on Vercel)
// read as 09:00 UTC — 14:30 for someone in India.
const instant = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");

const eventSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().optional(),
    startDate: instant,
    endDate: instant,
    isAllDay: z.boolean().default(false),
    color: z.string().optional(),
    recurrence: z.enum(RECURRENCES).nullable().optional(),
    // Last day (YYYY-MM-DD) an occurrence may start on.
    recurrenceUntil: z.string().refine(isDateKey, "Invalid date").nullable().optional(),
  })
  .refine((e) => Date.parse(e.endDate) >= Date.parse(e.startDate), {
    message: "An event can't end before it starts.",
    path: ["endDate"],
  });

function revalidateCalendar() {
  revalidatePath("/calendar");
  revalidatePath("/today");
}

export async function createEvent(data: z.input<typeof eventSchema>) {
  const userId = await getUserId();
  const validated = eventSchema.parse(data);
  const event = await prisma.calendarEvent.create({
    data: {
      ...validated,
      userId,
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate),
      recurrenceUntil: validated.recurrenceUntil ? keyToUtcDate(validated.recurrenceUntil) : null,
    },
  });
  revalidateCalendar();
  return { success: true, data: event };
}

export async function updateEvent(eventId: string, data: z.input<typeof eventSchema>) {
  const userId = await getUserId();
  const existing = await prisma.calendarEvent.findFirst({ where: { id: eventId, userId } });
  if (!existing) throw new Error("Event not found.");
  const validated = eventSchema.parse(data);

  const updateData: Prisma.CalendarEventUpdateInput = {
    ...validated,
    startDate: new Date(validated.startDate),
    endDate: new Date(validated.endDate),
    recurrenceUntil: validated.recurrenceUntil ? keyToUtcDate(validated.recurrenceUntil) : null,
  };

  await prisma.calendarEvent.update({ where: { id: eventId }, data: updateData });
  revalidateCalendar();
  return { success: true };
}

/** Deletes the event — for a repeating event, the whole series. */
export async function deleteEvent(eventId: string) {
  const userId = await getUserId();
  const existing = await prisma.calendarEvent.findFirst({ where: { id: eventId, userId } });
  if (!existing) throw new Error("Event not found.");
  await prisma.calendarEvent.delete({ where: { id: eventId } });
  revalidateCalendar();
  return { success: true };
}

/**
 * Events (repeating ones expanded) and dated tasks for the days
 * [fromKey, toKey]. `timezone` is the browser's zone, which places events on
 * the days the user sees; the saved zone is the fallback.
 */
export async function getCalendarAction(fromKey: string, toKey: string, timezone?: string) {
  try {
    const userId = await getUserId();
    if (!isDateKey(fromKey) || !isDateKey(toKey) || fromKey > toKey) throw new Error("Invalid range.");
    const tz = isValidTimezone(timezone) ? timezone : await getUserTimezone(userId);

    const [events, tasks] = await Promise.all([
      listEventOccurrences(userId, fromKey, toKey, tz),
      prisma.task.findMany({
        where: {
          userId,
          deletedAt: null,
          dueDate: { gte: keyToUtcDate(fromKey), lte: keyToUtcDate(toKey) },
        },
        select: { id: true, title: true, status: true, priority: true, dueDate: true, dueTime: true },
        orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }],
      }),
    ]);

    return { success: true, data: { events, tasks } };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/** The stored event, for the edit dialog (occurrences only carry a copy). */
export async function getEventAction(eventId: string) {
  try {
    const userId = await getUserId();
    const event = await prisma.calendarEvent.findFirst({ where: { id: eventId, userId } });
    if (!event) throw new Error("Event not found.");
    return { success: true, data: event };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}
