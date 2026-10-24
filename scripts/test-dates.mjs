// Checks on the day-key, streak and recurrence helpers. Run with:
// node scripts/test-dates.mjs
//
// Imports src/lib/dates.ts directly; Node strips the types itself (22.18+).
import assert from "node:assert/strict";
import {
  dateKeyInZone,
  zonedDayStart,
  addMonths,
  startOfWeek,
  computeStreaks,
  nextOccurrence,
  nextDueAfterCompletion,
  occurrencesBetween,
} from "../src/lib/dates.ts";

// --- Time zones -------------------------------------------------------------

// 20:00 UTC on Oct 23 is already Oct 24 in India and still Oct 23 in New York.
const evening = new Date("2026-10-23T20:00:00Z");
assert.equal(dateKeyInZone(evening, "Asia/Kolkata"), "2026-10-24");
assert.equal(dateKeyInZone(evening, "America/New_York"), "2026-10-23");
assert.equal(dateKeyInZone(evening, "Not/AZone"), "2026-10-23", "bad zone falls back to UTC");

// A day in India starts at 18:30 UTC the evening before.
assert.equal(zonedDayStart("2026-10-24", "Asia/Kolkata").toISOString(), "2026-10-23T18:30:00.000Z");
assert.equal(zonedDayStart("2026-10-24", "UTC").toISOString(), "2026-10-24T00:00:00.000Z");
// New York, either side of the November DST change.
assert.equal(zonedDayStart("2026-10-24", "America/New_York").toISOString(), "2026-10-24T04:00:00.000Z");
assert.equal(zonedDayStart("2026-11-02", "America/New_York").toISOString(), "2026-11-02T05:00:00.000Z");

// --- Calendar arithmetic ----------------------------------------------------

assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
assert.equal(addMonths("2028-01-31", 1), "2028-02-29", "leap year");
assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
assert.equal(startOfWeek("2026-10-24"), "2026-10-19", "Saturday -> Monday");
assert.equal(startOfWeek("2026-10-19"), "2026-10-19", "Monday stays");
assert.equal(startOfWeek("2026-10-25"), "2026-10-19", "Sunday belongs to the week before");

// --- Streaks ----------------------------------------------------------------

// Not yet ticked today: yesterday's run still counts.
assert.deepEqual(
  computeStreaks(["2026-10-21", "2026-10-22", "2026-10-23"], "DAILY", "2026-10-24"),
  { streak: 3, maxStreak: 3 }
);
// Ticked today too.
assert.equal(computeStreaks(["2026-10-22", "2026-10-23", "2026-10-24"], "DAILY", "2026-10-24").streak, 3);
// A full missed day ends it, but the best run is remembered.
assert.deepEqual(
  computeStreaks(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-22"], "DAILY", "2026-10-24"),
  { streak: 0, maxStreak: 3 }
);
// Weekly habit: one tick per week, any day of the week, is a streak in weeks.
assert.deepEqual(
  computeStreaks(["2026-10-01", "2026-10-06", "2026-10-17"], "WEEKLY", "2026-10-24"),
  { streak: 3, maxStreak: 3 }
);
// Two ticks in the same week are still one week.
assert.equal(computeStreaks(["2026-10-19", "2026-10-20"], "WEEKLY", "2026-10-24").streak, 1);
// Monthly, across a year boundary.
assert.equal(computeStreaks(["2025-11-03", "2025-12-30", "2026-01-02"], "MONTHLY", "2026-01-20").streak, 3);
assert.deepEqual(computeStreaks([], "DAILY", "2026-10-24"), { streak: 0, maxStreak: 0 });

// --- Recurrence -------------------------------------------------------------

assert.equal(nextOccurrence("2026-10-23", "WEEKDAYS"), "2026-10-26", "Friday -> Monday");
assert.equal(nextOccurrence("2026-10-24", "WEEKLY"), "2026-10-31");
assert.equal(nextOccurrence("2026-01-31", "MONTHLY"), "2026-02-28");
assert.equal(nextOccurrence("2028-02-29", "YEARLY"), "2029-02-28");

// Finishing an overdue daily task schedules tomorrow, not a past day.
assert.equal(nextDueAfterCompletion("2026-10-19", "DAILY", "2026-10-24"), "2026-10-25");
// Finishing early keeps the cadence.
assert.equal(nextDueAfterCompletion("2026-10-30", "WEEKLY", "2026-10-24"), "2026-11-06");
// No due date: anchored on today.
assert.equal(nextDueAfterCompletion(null, "DAILY", "2026-10-24"), "2026-10-25");
// Catching up months steps from the original day, without compounding clamps.
assert.equal(nextDueAfterCompletion("2026-01-31", "MONTHLY", "2026-03-05"), "2026-03-31");

assert.deepEqual(
  occurrencesBetween("2026-10-01", "WEEKLY", "2026-10-12", "2026-10-31"),
  ["2026-10-15", "2026-10-22", "2026-10-29"]
);
assert.deepEqual(
  occurrencesBetween("2026-10-01", "WEEKDAYS", "2026-10-23", "2026-10-27"),
  ["2026-10-23", "2026-10-26", "2026-10-27"]
);
assert.deepEqual(
  occurrencesBetween("2026-01-31", "MONTHLY", "2026-02-01", "2026-04-30"),
  ["2026-02-28", "2026-03-31", "2026-04-30"]
);
assert.deepEqual(
  occurrencesBetween("2026-10-01", "DAILY", "2026-10-05", "2026-10-31", "2026-10-07"),
  ["2026-10-05", "2026-10-06", "2026-10-07"],
  "until date caps the series"
);
assert.deepEqual(occurrencesBetween("2026-11-01", "DAILY", "2026-10-01", "2026-10-31"), []);

console.log("dates: all checks passed");
