import assert from "node:assert/strict";
import { BASE, db, createUser, openPage } from "../harness.mjs";

const user = await createUser();
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

try {
  await db.query(
    `INSERT INTO "Task"(id,"userId",title,priority,status,"actualTime","isFavorite","dueDate","createdAt","updatedAt")
     VALUES ($1,$2,'Pay rent','HIGH','TODO',0,false,$3,now(),now())`,
    ["t" + user.id, user.id, today + "T00:00:00Z"]
  );
  await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle" });
  await page.getByText("Pay rent").first().waitFor();
  step("dated task shows on its day");

  // Create a weekly 09:00 event today in IST.
  await page.getByRole("button", { name: "New Event" }).click();
  await page.locator("#ev-title").fill("Standup");
  await page.locator("#ev-date").fill(today);
  await page.getByLabel("Start time").fill("09:00");
  await page.getByLabel("End time").fill("09:30");
  await page.locator("#ev-repeat").selectOption("WEEKLY");
  await page.getByRole("button", { name: "Create Event" }).click();
  await page.waitForTimeout(1500);

  const ev = (await db.query(`SELECT "startDate", "endDate", recurrence FROM "CalendarEvent" WHERE "userId"=$1`, [user.id])).rows[0];
  const expectedStart = new Date(Date.parse(today + "T09:00:00+05:30")).toISOString();
  assert.equal(ev.startDate.toISOString(), expectedStart, "09:00 IST stored as 03:30 UTC");
  assert.equal(ev.recurrence, "WEEKLY");
  step("event stored at the right instant (" + expectedStart + ")");

  const chips = await page.locator("button", { hasText: "Standup" }).count();
  assert.ok(chips >= 4, `weekly event appears on several days of the month (${chips})`);
  step(`weekly event expanded across the month (${chips} chips incl. upcoming list)`);

  // Week view shows the time.
  await page.getByRole("button", { name: "week", exact: true }).click();
  await page.getByText("9:00 AM").first().waitFor();
  step("week view shows 9:00 AM");

  // Edit: rename via the dialog.
  await page.locator("button", { hasText: "Standup" }).first().click();
  await page.locator("#ev-title").fill("Daily standup");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("Daily standup").first().waitFor();
  step("edited event");

  // ICS export.
  const res = await page.request.get(`${BASE}/api/calendar/ics`);
  assert.equal(res.status(), 200);
  const ics = await res.text();
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /RRULE:FREQ=WEEKLY/);
  assert.match(ics, /SUMMARY:Daily standup/);
  assert.match(ics, /SUMMARY:Task: Pay rent/);
  step("ICS export includes event with RRULE and the task");

  const anon = await (await import("playwright-core")).request.newContext();
  assert.equal((await anon.get(`${BASE}/api/calendar/ics`)).status(), 401);
  step("ICS export refuses anonymous requests");

  assert.deepEqual(errors.filter((e) => !/DevTools|favicon|HMR|Fast Refresh/.test(e)), []);
  console.log("CALENDAR E2E PASSED");
} catch (e) {
  await page.screenshot({ path: "calendar-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
