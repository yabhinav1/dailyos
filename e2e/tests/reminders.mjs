import assert from "node:assert/strict";
import { BASE, MAIL, CRON_SECRET, SCHEDULER_SECRET, db, createUser, dayIn, step } from "../harness.mjs";

// Etc/GMT-N is UTC+N (the sign is inverted in the tz database). Returns a
// zone where it is currently `want` o'clock, and that zone's UTC offset.
function zoneAtHour(want) {
  const h = new Date().getUTCHours();
  let off = (((want - h) % 24) + 24) % 24;
  if (off > 14) off -= 24;
  return { tz: off === 0 ? "Etc/UTC" : off > 0 ? `Etc/GMT-${off}` : `Etc/GMT+${-off}`, off };
}

const { tz: morningTz, off } = zoneAtHour(9);
const busy = await createUser(morningTz);
const night = await createUser(zoneAtHour(22).tz);
const off_ = await createUser(morningTz);
const idle = await createUser(morningTz);
await db.query(`UPDATE "UserSettings" SET "remindersEnabled"=false WHERE "userId"=$1`, [off_.id]);

const today = dayIn(morningTz);
const task = (u, id, title, due) =>
  db.query(
    `INSERT INTO "Task"(id,"userId",title,priority,status,"actualTime","isFavorite","dueDate","createdAt","updatedAt")
     VALUES ($1,$2,$3,'MEDIUM','TODO',0,false,$4,now(),now())`,
    [id + u.id, u.id, title, due + "T00:00:00Z"]
  );
await task(busy, "a", "Pay <b>rent</b> & bills", today);
await task(busy, "b", "Old thing", dayIn(morningTz, -1));
await task(night, "a", "Night owl task", dayIn(zoneAtHour(22).tz));
await task(off_, "a", "Should not be emailed", today);
// 07:00 local in the morning zone.
const sevenLocal = new Date(Date.parse(`${today}T07:00:00Z`) - off * 3600000);
await db.query(
  `INSERT INTO "CalendarEvent"(id,"userId",title,"startDate","endDate","isAllDay","createdAt","updatedAt") VALUES ($1,$2,'Gym',$3,$4,false,now(),now())`,
  ["e" + busy.id, busy.id, sevenLocal.toISOString(), new Date(sevenLocal.getTime() + 3600000).toISOString()]
);

const cron = (auth) => fetch(`${BASE}/api/cron/reminders`, { headers: auth ? { authorization: auth } : {} });
const mailsTo = async (u) =>
  (await (await fetch(`${MAIL}/messages?limit=500`)).json()).messages.filter((m) => m.To.some((t) => t.Address === u.email));

try {
  assert.equal((await cron()).status, 401);
  assert.equal((await cron("Bearer nope")).status, 401);
  step("refuses a missing or wrong secret");

  const first = await cron(`Bearer ${CRON_SECRET}`);
  assert.equal(first.status, 200);

  assert.equal((await mailsTo(busy)).length, 1, "user in their morning emailed once");
  assert.equal((await mailsTo(night)).length, 0, "user at 10pm local not emailed");
  assert.equal((await mailsTo(off_)).length, 0, "reminders off -> no email");
  assert.equal((await mailsTo(idle)).length, 0, "nothing due -> no email");
  const night_ = (await db.query(`SELECT "lastDigestOn" FROM "UserSettings" WHERE "userId"=$1`, [night.id])).rows[0];
  assert.equal(night_.lastDigestOn, null, "the night user's day isn't used up");
  step("sent only to people in their own 8am-noon window, with reminders on and something due");

  const msg = await (await fetch(`${MAIL}/message/${(await mailsTo(busy))[0].ID}`)).json();
  assert.match(msg.Subject, /^Your day · /);
  assert.match(msg.HTML, /Pay &lt;b&gt;rent&lt;\/b&gt; &amp; bills/, "titles escaped");
  assert.match(msg.HTML, /Old thing/);
  assert.match(msg.HTML, /Gym.*7:00 AM/s, "event time in the user's zone");
  const notes = (await db.query(`SELECT message FROM "Notification" WHERE "userId"=$1`, [busy.id])).rows;
  assert.deepEqual(notes.map((n) => n.message), ["1 due today · 1 overdue · 1 event"]);
  step("email lists due, overdue and events (local times, escaped); in-app notification too");

  assert.equal((await cron(`Bearer ${SCHEDULER_SECRET}`)).status, 200, "scheduler secret accepted");
  assert.equal((await mailsTo(busy)).length, 1, "no second email the same day");
  step("the hourly scheduler's secret works, and a re-run never repeats a day");
} finally {
  await db.end();
}
