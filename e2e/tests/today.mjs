import assert from "node:assert/strict";
import { BASE, db, createUser, openPage } from "../harness.mjs";

const user = await createUser();
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);

try {
  const task = (id, title, due, status = "TODO") =>
    db.query(
      `INSERT INTO "Task"(id,"userId",title,priority,status,"actualTime","isFavorite","dueDate","createdAt","updatedAt")
       VALUES ($1,$2,$3,'MEDIUM',$4,0,false,$5,now(),now())`,
      [id + user.id, user.id, title, status, due + "T00:00:00Z"]
    );
  await task("a", "Send invoice", today);
  await task("b", "Renew passport", yesterday);
  await db.query(
    `INSERT INTO "Habit"(id,"userId",name,frequency,streak,"maxStreak","createdAt","updatedAt") VALUES ($1,$2,'Meditate','DAILY',0,0,now(),now())`,
    ["h" + user.id, user.id]
  );
  await db.query(
    `INSERT INTO "CalendarEvent"(id,"userId",title,"startDate","endDate","isAllDay","createdAt","updatedAt")
     VALUES ($1,$2,'Dentist',$3,$4,false,now(),now())`,
    ["e" + user.id, user.id, new Date(Date.parse(today + "T15:00:00+05:30")).toISOString(), new Date(Date.parse(today + "T16:00:00+05:30")).toISOString()]
  );

  // Signed-in root now lands on Today.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  assert.match(page.url(), /\/today$/);
  step("/ redirects to /today");

  await page.getByText("Send invoice").waitFor();
  await page.getByText("Renew passport").waitFor();
  await page.getByText("Overdue").waitFor();
  await page.getByText("Dentist").waitFor();
  await page.getByText("3:00 PM – 4:00 PM").waitFor();
  await page.getByText("Meditate").waitFor();
  step("shows due, overdue, event at 3:00 PM IST, habit");

  await page.getByLabel('Mark "Send invoice" done').click();
  await page.waitForTimeout(1500);
  assert.equal((await db.query(`SELECT status FROM "Task" WHERE id=$1`, ["a" + user.id])).rows[0].status, "COMPLETED");
  step("ticked a task");

  await page.getByRole("button", { name: /Meditate/ }).click();
  await page.waitForTimeout(1500);
  const log = (await db.query(`SELECT date FROM "HabitLog" WHERE "habitId"=$1`, ["h" + user.id])).rows[0];
  assert.equal(log.date.toISOString().slice(0, 10), today);
  step("checked in a habit for today");

  await page.getByLabel("Add a task for today").fill("Call mom");
  await page.getByLabel("Add task").click();
  await page.getByText("Call mom").waitFor();
  const added = (await db.query(`SELECT "dueDate", priority, status FROM "Task" WHERE title='Call mom' AND "userId"=$1`, [user.id])).rows[0];
  assert.equal(added.dueDate.toISOString().slice(0, 10), today);
  assert.equal(added.priority, "MEDIUM");
  step("quick-add creates a task due today");

  await page.screenshot({ path: "today.png", fullPage: true });
  assert.deepEqual(errors.filter((e) => !/DevTools|favicon|HMR|Fast Refresh/.test(e)), []);
  console.log("TODAY E2E PASSED");
} catch (e) {
  await page.screenshot({ path: "today-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
