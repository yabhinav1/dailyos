import { prisma } from "@/lib/prisma";
import { DEFAULT_TIMEZONE, dateKeyInZone, diffDays, isDateKey, isValidTimezone, type DateKey } from "@/lib/dates";

/** The user's saved IANA zone, or UTC until the browser has reported one. */
export async function getUserTimezone(userId: string): Promise<string> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return isValidTimezone(settings?.timezone) ? settings.timezone : DEFAULT_TIMEZONE;
}

/**
 * "Today" for this user. A key sent by the browser wins, since it reflects
 * where they are right now, but only within a day of UTC — every real zone
 * is, and anything further out is a bad clock or a crafted request.
 */
export async function getUserToday(userId: string, clientToday?: unknown): Promise<DateKey> {
  const utcToday = dateKeyInZone(new Date(), "UTC");
  if (isDateKey(clientToday) && Math.abs(diffDays(clientToday, utcToday)) <= 1) {
    return clientToday;
  }
  return dateKeyInZone(new Date(), await getUserTimezone(userId));
}
