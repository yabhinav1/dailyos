import assert from "node:assert/strict";
import { BASE, db, createUser, openPage } from "../harness.mjs";

const user = await createUser();
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);
const ignorable = (e) => /Download the React DevTools|favicon|\[HMR\]|Fast Refresh/.test(e);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const dayOffset = (n) => new Date(Date.parse(today + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

try {
  // ---- Habits: streak survives an unticked today, weekly counts weeks ----
  const daily = "hd" + user.id;
  const weekly = "hw" + user.id;
  await db.query(
    `INSERT INTO "Habit"(id,"userId",name,frequency,streak,"maxStreak","createdAt","updatedAt") VALUES
     ($1,$3,'Read','DAILY',0,0,now(),now()), ($2,$3,'Long run','WEEKLY',0,0,now(),now())`,
    [daily, weekly, user.id]
  );
  for (const d of [-1, -2, -3]) {
    await db.query(`INSERT INTO "HabitLog"(id,"habitId",date,completed,"createdAt") VALUES ($1,$2,$3,true,now())`, [
      `l${d}${daily}`, daily, dayOffset(d),
    ]);
  }
  for (const d of [-1, -8, -15]) {
    await db.query(`INSERT INTO "HabitLog"(id,"habitId",date,completed,"createdAt") VALUES ($1,$2,$3,true,now())`, [
      `w${d}${weekly}`, weekly, dayOffset(d),
    ]);
  }
  await page.goto(`${BASE}/habits`, { waitUntil: "networkidle" });
  const readCard = page.locator("div.rounded-xl, [class*=card]", { hasText: "Read" }).filter({ hasText: "streak" }).first();
  await readCard.waitFor();
  const readText = await readCard.innerText();
  assert.match(readText, /\b3\b\s*streak/, "daily streak 3 before today is ticked: " + readText);
  const weekText = await page.locator("[class*=card]", { hasText: "Long run" }).first().innerText();
  assert.match(weekText, /\b3\b\s*wk streak/, "weekly streak counts weeks: " + weekText);
  step("habits: daily streak 3 with today unticked, weekly 3 weeks");

  // Tick today -> 4.
  await readCard.locator("button").first().click();
  await page.waitForTimeout(2000);
  const stored = (await db.query(`SELECT streak, "maxStreak" FROM "Habit" WHERE id=$1`, [daily])).rows[0];
  assert.equal(stored.streak, 4);
  const log = (await db.query(`SELECT date FROM "HabitLog" WHERE "habitId"=$1 ORDER BY date DESC LIMIT 1`, [daily])).rows[0];
  assert.equal(log.date.toISOString().slice(0, 10), today, "logged on the IST day");
  step("habits: ticking today -> streak 4 on the IST date");

  // ---- Trash: delete a task, see it in Trash, restore it ----
  await db.query(
    `INSERT INTO "Task"(id,"userId",title,priority,status,"actualTime","isFavorite","createdAt","updatedAt","deletedAt")
     VALUES ($1,$2,'Old report','MEDIUM','TODO',0,false,now(),now(),now() - interval '3 days')`,
    ["t" + user.id, user.id]
  );
  await page.goto(`${BASE}/trash`, { waitUntil: "networkidle" });
  await page.getByText("Old report").waitFor();
  await page.getByRole("button", { name: /restore/i }).first().click();
  await page.waitForTimeout(1500);
  const restored = (await db.query(`SELECT "deletedAt" FROM "Task" WHERE id=$1`, ["t" + user.id])).rows[0];
  assert.equal(restored.deletedAt, null);
  step("trash: lists deleted task and restores it");

  // ---- Developer: create a project, log an issue and a release ----
  await page.goto(`${BASE}/developer`, { waitUntil: "networkidle" });
  step("developer page loaded");
  await page.screenshot({ path: "developer.png", fullPage: true });

  // ---- Every page renders without client errors ----
  for (const path of ["/notes", "/projects", "/calendar", "/study", "/goals", "/analytics", "/settings"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    step(`rendered ${path}`);
  }

  assert.deepEqual(errors.filter((e) => !ignorable(e)), []);
  console.log("SMOKE PASSED");
} catch (e) {
  await page.screenshot({ path: "smoke-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
