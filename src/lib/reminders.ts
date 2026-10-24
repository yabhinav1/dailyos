import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { sendDailyDigestEmail, type DigestItem } from "@/lib/email";
import { DEFAULT_TIMEZONE, dateKeyInZone, isValidTimezone, keyToUtcDate, utcDateToKey } from "@/lib/dates";
import { listEventOccurrences } from "@/lib/events";

export type DigestResult = "sent" | "empty" | "skipped";

/**
 * The morning digest for one user: overdue tasks, tasks due today and
 * today's events, in their own zone. Sends an email and an in-app
 * notification when there is anything to say, and records the day either
 * way so a re-run of the cron never repeats it.
 */
export async function sendDigestForUser(
  user: { id: string; email: string; name: string | null },
  settings: { timezone: string | null; lastDigestOn: string | null } | null,
  now: Date = new Date()
): Promise<DigestResult> {
  const tz = isValidTimezone(settings?.timezone) ? settings.timezone : DEFAULT_TIMEZONE;
  const todayKey = dateKeyInZone(now, tz);
  if (settings?.lastDigestOn === todayKey) return "skipped";

  const todayDate = keyToUtcDate(todayKey);
  const [overdue, dueToday, events] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "COMPLETED" }, dueDate: { lt: todayDate } },
      select: { title: true, dueDate: true, dueTime: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.task.findMany({
      where: { userId: user.id, deletedAt: null, status: { not: "COMPLETED" }, dueDate: todayDate },
      select: { title: true, dueTime: true },
      orderBy: { dueTime: "asc" },
      take: 20,
    }),
    listEventOccurrences(user.id, todayKey, todayKey, tz),
  ]);

  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const digest = {
    overdue: overdue.map<DigestItem>((t) => ({
      title: t.title,
      when: t.dueDate
        ? new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
        : null,
    })),
    dueToday: dueToday.map<DigestItem>((t) => ({ title: t.title, when: t.dueTime })),
    events: events.map<DigestItem>((e) => ({ title: e.title, when: e.isAllDay ? "All day" : time(e.start) })),
  };
  const count = digest.overdue.length + digest.dueToday.length + digest.events.length;

  // Claim the day first: if the email fails part-way, a retry tomorrow is
  // better than a duplicate today.
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { lastDigestOn: todayKey },
    create: { userId: user.id, lastDigestOn: todayKey },
  });

  if (count === 0) return "empty";

  const parts = [
    digest.dueToday.length && `${digest.dueToday.length} due today`,
    digest.overdue.length && `${digest.overdue.length} overdue`,
    digest.events.length && `${digest.events.length} event${digest.events.length === 1 ? "" : "s"}`,
  ].filter(Boolean);
  await createNotification(user.id, "Your day", parts.join(" · "), "TASK");
  await sendDailyDigestEmail(user.email, user.name, todayKey, digest);
  return "sent";
}

/** Runs the digest for every user who has reminders on. */
export async function sendDailyDigests(now: Date = new Date()) {
  const users = await prisma.user.findMany({
    where: {
      deletionScheduledAt: null,
      AND: [
        // Only addresses known to be real: verified by code, or by Google or
        // GitHub at sign-in (OAuth accounts never get emailVerified set).
        { OR: [{ emailVerified: { not: null } }, { accounts: { some: {} } }] },
        // No settings row yet means the default, which is on.
        { OR: [{ settings: null }, { settings: { remindersEnabled: true } }] },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      settings: { select: { timezone: true, lastDigestOn: true } },
    },
  });

  const tally = { sent: 0, empty: 0, skipped: 0, failed: 0 };
  for (const user of users) {
    try {
      tally[await sendDigestForUser(user, user.settings, now)] += 1;
    } catch (err) {
      // One bad account must not stop the rest of the run.
      tally.failed += 1;
      console.error(`[reminders] digest failed for ${user.id}:`, err);
    }
  }
  return { users: users.length, ...tally, day: utcDateToKey(now) };
}
