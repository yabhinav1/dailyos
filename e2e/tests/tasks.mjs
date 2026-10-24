import assert from "node:assert/strict";
import { BASE, db, createUser, openPage } from "../harness.mjs";

const user = await createUser();
await db.query(
  `INSERT INTO "Goal"(id, "userId", title, progress, timeframe, "isCompleted", "createdAt", "updatedAt") VALUES ($1,$2,'Ship v2',0,'MONTHLY',false,now(),now())`,
  ["g" + user.id, user.id]
);
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);

try {
  await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
  step("tasks page loaded");

  // Create a recurring, tagged, goal-linked HIGH priority task.
  await page.getByRole("button", { name: "New Task" }).click();
  await page.locator("#title").fill("Water plants");
  await page.locator("#priority").selectOption("HIGH");
  await page.locator("#dueDate").fill("2026-10-20");
  await page.locator("#recurrence").selectOption("DAILY");
  await page.locator("#goal").selectOption({ label: "Ship v2" });
  const tagBox = page.getByLabel("Add a tag");
  await tagBox.fill("home");
  await tagBox.press("Enter");
  await tagBox.fill("chores");
  await tagBox.press("Enter");
  await page.getByRole("button", { name: "Create Task" }).click();
  await page.getByText("Water plants").first().waitFor();
  step("created task");

  let { rows } = await db.query(
    `SELECT t.id, t.priority, t.recurrence, t."goalId", t."dueDate", array_agg(g.name ORDER BY g.name) tags
       FROM "Task" t LEFT JOIN "TaskTag" tt ON tt."taskId"=t.id LEFT JOIN "Tag" g ON g.id=tt."tagId"
      WHERE t."userId"=$1 GROUP BY t.id`,
    [user.id]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].priority, "HIGH");
  assert.equal(rows[0].recurrence, "DAILY");
  assert.equal(rows[0].goalId, "g" + user.id);
  assert.deepEqual(rows[0].tags, ["chores", "home"]);
  assert.equal(rows[0].dueDate.toISOString(), "2026-10-20T00:00:00.000Z");
  step("stored: HIGH, DAILY, goal, tags, due date as UTC midnight");

  // Overdue styling and tags render in the list.
  await page.getByText("#home").first().waitFor();

  // Tick it complete from the list.
  await page.locator("tbody tr").first().locator("td").first().getByRole("button").click();
  await page.waitForTimeout(2500);

  ({ rows } = await db.query(
    `SELECT title, status, priority, "dueDate", recurrence FROM "Task" WHERE "userId"=$1 ORDER BY "createdAt"`,
    [user.id]
  ));
  assert.equal(rows.length, 2, "next occurrence created");
  assert.equal(rows[0].status, "COMPLETED");
  assert.equal(rows[0].priority, "HIGH", "priority survived a status-only update");
  assert.equal(rows[1].status, "TODO");
  assert.equal(rows[1].priority, "HIGH");
  assert.equal(rows[1].recurrence, "DAILY");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const tomorrow = new Date(Date.parse(today + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
  assert.equal(rows[1].dueDate.toISOString().slice(0, 10), tomorrow, "next due is tomorrow, not a past day");
  step(`completed -> next occurrence due ${tomorrow}, priority kept`);

  const goal = (await db.query(`SELECT progress FROM "Goal" WHERE id=$1`, ["g" + user.id])).rows[0];
  assert.equal(goal.progress, 50, "goal = 1 of 2 linked tasks done");
  step("goal progress 50%");

  // Untick and re-tick: no duplicate occurrence.
  await page.reload({ waitUntil: "networkidle" });
  const doneRow = page.locator("tbody tr", { hasText: "Water plants" }).filter({ has: page.locator(".line-through") });
  await doneRow.locator("td").first().getByRole("button").click();
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("tbody tr", { hasText: "Water plants" }).first().waitFor();
  const count1 = (await db.query(`SELECT count(*)::int n FROM "Task" WHERE "userId"=$1`, [user.id])).rows[0].n;
  assert.equal(count1, 2);
  step("untick/re-tick does not duplicate");

  // Details dialog: subtask + comment.
  await page.locator("tbody tr").first().locator("span.font-semibold").first().click();
  await page.getByLabel("New subtask").fill("Fill can");
  await page.getByLabel("Add subtask").click();
  await page.getByText("Fill can").waitFor();
  await page.getByLabel("New comment").fill("Used rainwater");
  await page.getByRole("button", { name: "Comment" }).click();
  await page.getByText("Used rainwater").waitFor();
  step("subtask and comment added in details dialog");

  // Tag filter.
  await page.keyboard.press("Escape");
  await page.getByText("Tag: All").click();
  await page.getByRole("menuitemcheckbox", { name: "#home" }).click();
  await page.waitForTimeout(1000);
  step("tag filter applied");

  assert.deepEqual(errors.filter((e) => !/Download the React DevTools|favicon/.test(e)), []);
  console.log("TASKS E2E PASSED");
} catch (e) {
  await page.screenshot({ path: "tasks-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
