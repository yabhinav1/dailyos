import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, utcDateToKey } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RRULES: Record<string, string> = {
  DAILY: "FREQ=DAILY",
  WEEKDAYS: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  WEEKLY: "FREQ=WEEKLY",
  MONTHLY: "FREQ=MONTHLY",
  YEARLY: "FREQ=YEARLY",
};

/** RFC 5545 text escaping. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateValue = (key: string) => key.replace(/-/g, "");

/** Lines longer than 75 octets are folded, per RFC 5545 3.1. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

/**
 * The signed-in user's events and dated tasks as an .ics file, for importing
 * into Google Calendar, Outlook or Apple Calendar. A download rather than a
 * subscription URL: a feed would need a long-lived secret in the link.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const [events, tasks] = await Promise.all([
    prisma.calendarEvent.findMany({ where: { userId }, orderBy: { startDate: "asc" } }),
    prisma.task.findMany({
      where: { userId, deletedAt: null, dueDate: { not: null } },
      select: { id: true, title: true, description: true, dueDate: true, status: true, updatedAt: true },
    }),
  ]);

  const now = stamp(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DailyOS//Calendar export//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:DailyOS"];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT", `UID:${ev.id}@dailyos`, `DTSTAMP:${now}`, `LAST-MODIFIED:${stamp(ev.updatedAt)}`);
    if (ev.isAllDay) {
      // All-day events are stored as local midnights; the start's UTC day can
      // be the evening before, so take the day from the midpoint instead.
      const mid = new Date((ev.startDate.getTime() + ev.endDate.getTime()) / 2);
      const days = Math.max(1, Math.round((ev.endDate.getTime() - ev.startDate.getTime()) / 86_400_000));
      const startKey = utcDateToKey(new Date(mid.getTime() - ((days - 1) * 86_400_000) / 2));
      lines.push(`DTSTART;VALUE=DATE:${dateValue(startKey)}`, `DTEND;VALUE=DATE:${dateValue(addDays(startKey, days))}`);
    } else {
      lines.push(`DTSTART:${stamp(ev.startDate)}`, `DTEND:${stamp(ev.endDate)}`);
    }
    if (ev.recurrence && RRULES[ev.recurrence]) {
      const until = ev.recurrenceUntil ? `;UNTIL=${dateValue(utcDateToKey(ev.recurrenceUntil))}T235959Z` : "";
      lines.push(`RRULE:${RRULES[ev.recurrence]}${until}`);
    }
    lines.push(`SUMMARY:${esc(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
    lines.push("END:VEVENT");
  }

  for (const task of tasks) {
    const key = utcDateToKey(task.dueDate!);
    lines.push(
      "BEGIN:VEVENT",
      `UID:task-${task.id}@dailyos`,
      `DTSTAMP:${now}`,
      `LAST-MODIFIED:${stamp(task.updatedAt)}`,
      `DTSTART;VALUE=DATE:${dateValue(key)}`,
      `DTEND;VALUE=DATE:${dateValue(addDays(key, 1))}`,
      `SUMMARY:${esc(`${task.status === "COMPLETED" ? "✓ " : ""}Task: ${task.title}`)}`
    );
    if (task.description) lines.push(`DESCRIPTION:${esc(task.description)}`);
    lines.push("TRANSP:TRANSPARENT", "END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="dailyos-${utcDateToKey(new Date())}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
