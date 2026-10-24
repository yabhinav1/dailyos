import { prisma } from "@/lib/prisma";
import {
  addDays,
  dateKeyInZone,
  isRecurrence,
  occurrencesBetween,
  zonedDayStart,
  type DateKey,
} from "@/lib/dates";

export type EventOccurrence = {
  /** Unique per occurrence: the event id, plus the day for a repeating one. */
  key: string;
  eventId: string;
  title: string;
  description: string | null;
  color: string | null;
  isAllDay: boolean;
  recurrence: string | null;
  start: Date;
  end: Date;
};

/**
 * Every event occurrence overlapping the days [fromKey, toKey] in `tz`,
 * sorted by start. Repeating events are expanded here rather than stored
 * per occurrence, so editing or deleting the series is a single row.
 */
export async function listEventOccurrences(
  userId: string,
  fromKey: DateKey,
  toKey: DateKey,
  tz: string
): Promise<EventOccurrence[]> {
  const rangeStart = zonedDayStart(fromKey, tz);
  const rangeEnd = zonedDayStart(addDays(toKey, 1), tz);

  const events = await prisma.calendarEvent.findMany({
    where: {
      userId,
      OR: [
        { recurrence: null, startDate: { lt: rangeEnd }, endDate: { gte: rangeStart } },
        {
          recurrence: { not: null },
          startDate: { lt: rangeEnd },
          OR: [{ recurrenceUntil: null }, { recurrenceUntil: { gte: addDaysToDate(rangeStart, -1) } }],
        },
      ],
    },
    orderBy: { startDate: "asc" },
  });

  const out: EventOccurrence[] = [];
  for (const ev of events) {
    const base = {
      eventId: ev.id,
      title: ev.title,
      description: ev.description,
      color: ev.color,
      isAllDay: ev.isAllDay,
      recurrence: ev.recurrence,
    };

    if (!isRecurrence(ev.recurrence)) {
      out.push({ ...base, key: ev.id, start: ev.startDate, end: ev.endDate });
      continue;
    }

    const durationMs = ev.endDate.getTime() - ev.startDate.getTime();
    const seriesStartKey = dateKeyInZone(ev.startDate, tz);
    // Time of day the series starts at, kept for every occurrence.
    const timeOfDayMs = ev.startDate.getTime() - zonedDayStart(seriesStartKey, tz).getTime();
    // An occurrence that starts before the range can still run into it.
    const spanDays = Math.ceil(durationMs / 86_400_000);
    const untilKey = ev.recurrenceUntil ? ev.recurrenceUntil.toISOString().slice(0, 10) : null;

    for (const dayKey of occurrencesBetween(seriesStartKey, ev.recurrence, addDays(fromKey, -spanDays), toKey, untilKey)) {
      const start = new Date(zonedDayStart(dayKey, tz).getTime() + timeOfDayMs);
      const end = new Date(start.getTime() + durationMs);
      if (end < rangeStart || start >= rangeEnd) continue;
      out.push({ ...base, key: `${ev.id}:${dayKey}`, start, end });
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function addDaysToDate(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}
