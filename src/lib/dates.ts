/**
 * Calendar-day arithmetic in the user's own time zone.
 *
 * The server runs in UTC on Vercel, so "today" from `new Date()` there is the
 * wrong day for anyone east or west of Greenwich for part of every day. Every
 * day-level comparison goes through `YYYY-MM-DD` keys computed in the user's
 * zone instead, and dates that represent a whole day (habit logs, task due
 * dates) are stored as UTC midnight of that key.
 *
 * No imports, so scripts/test-dates.mjs can load this file directly.
 */

export type DateKey = string;

export const DEFAULT_TIMEZONE = "UTC";

export type HabitFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export const RECURRENCES = ["DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the runtime knows this IANA zone name. */
export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar day `date` falls on in `tz`. */
export function dateKeyInZone(date: Date, tz: string = DEFAULT_TIMEZONE): DateKey {
  const zone = isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** The calendar day in the browser's own zone. */
export function localDateKey(date: Date = new Date()): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** UTC midnight of a day key — how whole-day dates are stored. */
export function keyToUtcDate(key: DateKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** The day key of a stored whole-day date (UTC midnight). */
export function utcDateToKey(date: Date | string): DateKey {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

export function isDateKey(value: unknown): value is DateKey {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(keyToUtcDate(value).getTime());
}

/** Whole days since 1970-01-01 (a Thursday). */
function dayNumber(key: DateKey): number {
  return Math.round(keyToUtcDate(key).getTime() / DAY_MS);
}

function fromDayNumber(n: number): DateKey {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromDayNumber(dayNumber(key) + days);
}

export function diffDays(later: DateKey, earlier: DateKey): number {
  return dayNumber(later) - dayNumber(earlier);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(key: DateKey): number {
  return keyToUtcDate(key).getUTCDay();
}

/** Monday of the week containing `key`. */
export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -((weekday(key) + 6) % 7));
}

/**
 * Adds calendar months, clamping to the last day of a shorter month
 * (Jan 31 + 1 month = Feb 28/29), as calendar apps do.
 */
export function addMonths(key: DateKey, months: number): DateKey {
  const [y, m, d] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Habit streaks
// ---------------------------------------------------------------------------

/**
 * Index of the period a day belongs to, so consecutive periods differ by 1.
 * Weeks start on Monday; 1970-01-01 was a Thursday, hence the +3.
 */
export function periodIndex(key: DateKey, frequency: HabitFrequency): number {
  if (frequency === "WEEKLY") return Math.floor((dayNumber(key) + 3) / 7);
  if (frequency === "MONTHLY") {
    const [y, m] = key.split("-").map(Number);
    return y * 12 + (m - 1);
  }
  return dayNumber(key);
}

/**
 * Current and best streak, counted in the habit's own periods: a weekly habit
 * checked once a week has a streak in weeks.
 *
 * The current period still in progress doesn't break the streak — a daily
 * habit not yet ticked this morning keeps yesterday's count until the day is
 * actually over.
 */
export function computeStreaks(
  logKeys: DateKey[],
  frequency: HabitFrequency,
  todayKey: DateKey
): { streak: number; maxStreak: number } {
  const periods = new Set(logKeys.map((k) => periodIndex(k, frequency)));
  if (periods.size === 0) return { streak: 0, maxStreak: 0 };

  let cursor = periodIndex(todayKey, frequency);
  if (!periods.has(cursor)) cursor -= 1;
  let streak = 0;
  while (periods.has(cursor)) {
    streak++;
    cursor--;
  }

  const sorted = [...periods].sort((a, b) => a - b);
  let maxStreak = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    maxStreak = Math.max(maxStreak, run);
  }

  return { streak, maxStreak: Math.max(maxStreak, streak) };
}

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

export function isRecurrence(value: unknown): value is Recurrence {
  return typeof value === "string" && (RECURRENCES as readonly string[]).includes(value);
}

/** The occurrence after `key`. Monthly and yearly clamp to short months. */
export function nextOccurrence(key: DateKey, rule: Recurrence): DateKey {
  switch (rule) {
    case "DAILY":
      return addDays(key, 1);
    case "WEEKDAYS": {
      let next = addDays(key, 1);
      while (weekday(next) === 0 || weekday(next) === 6) next = addDays(next, 1);
      return next;
    }
    case "WEEKLY":
      return addDays(key, 7);
    case "MONTHLY":
      return addMonths(key, 1);
    case "YEARLY":
      return addMonths(key, 12);
  }
}

/**
 * Due date for the copy created when a recurring task is completed: the first
 * occurrence after both the old due date and today, so finishing a daily task
 * that's five days overdue schedules tomorrow rather than four past days.
 *
 * Monthly and yearly steps are counted from the old due date rather than
 * chained, so catching up several months doesn't compound day clamping.
 */
export function nextDueAfterCompletion(dueKey: DateKey | null, rule: Recurrence, todayKey: DateKey): DateKey {
  const anchor = dueKey ?? todayKey;
  if (rule === "MONTHLY" || rule === "YEARLY") {
    const step = rule === "MONTHLY" ? 1 : 12;
    for (let i = 1; ; i++) {
      const candidate = addMonths(anchor, step * i);
      if (candidate > todayKey) return candidate;
    }
  }
  let next = nextOccurrence(anchor, rule);
  while (next <= todayKey) next = nextOccurrence(next, rule);
  return next;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/**
 * "Oct 24" for a stored whole-day date. Formatting in UTC keeps the day the
 * user picked; local formatting showed the day before anywhere west of UTC.
 */
export function formatDay(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  return new Date(date).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

/** A whole-day due date is overdue only once that day is over for the user. */
export function isPastDue(dueDate: Date | string | null | undefined, todayKey: DateKey): boolean {
  return !!dueDate && utcDateToKey(dueDate) < todayKey;
}

/**
 * Start days of a recurring series that fall within [fromKey, toKey].
 * Monthly/yearly occurrences step from the series start so day-of-month
 * clamping doesn't drift.
 */
export function occurrencesBetween(
  startKey: DateKey,
  rule: Recurrence,
  fromKey: DateKey,
  toKey: DateKey,
  untilKey?: DateKey | null
): DateKey[] {
  const last = untilKey && untilKey < toKey ? untilKey : toKey;
  const out: DateKey[] = [];
  if (startKey > last) return out;

  if (rule === "MONTHLY" || rule === "YEARLY") {
    const step = rule === "MONTHLY" ? 1 : 12;
    for (let i = 0; i < 2400; i++) {
      const k = addMonths(startKey, step * i);
      if (k > last) break;
      if (k >= fromKey) out.push(k);
    }
    return out;
  }

  let k = startKey;
  // Jump close to the window instead of walking years of daily occurrences.
  if (rule === "DAILY" && k < fromKey) k = fromKey;
  if (rule === "WEEKLY" && k < fromKey) k = addDays(k, Math.floor(diffDays(fromKey, k) / 7) * 7);
  if (rule === "WEEKDAYS" && k < fromKey) k = nextOccurrence(addDays(fromKey, -1), rule);

  for (let i = 0; i < 1000 && k <= last; i++) {
    if (k >= fromKey) out.push(k);
    k = nextOccurrence(k, rule);
  }
  return out;
}
