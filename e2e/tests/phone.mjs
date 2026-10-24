import assert from "node:assert/strict";
import { BASE, db, createUser, openPage, step, ignorable } from "../harness.mjs";

const user = await createUser();
const noteId = "n" + user.id;
await db.query(
  `INSERT INTO "Note"(id,"userId",title,content,"isPinned","isFavorite","createdAt","updatedAt") VALUES ($1,$2,'Phone note','<p>Hello from a phone</p>',false,false,now(),now())`,
  [noteId, user.id]
);
await db.query(
  `INSERT INTO "Task"(id,"userId",title,priority,status,"actualTime","isFavorite","createdAt","updatedAt") VALUES ($1,$2,'A task with a fairly long title to wrap','HIGH','TODO',0,false,now(),now())`,
  ["t" + user.id, user.id]
);

const { browser, page, errors } = await openPage(user);
await page.setViewportSize({ width: 375, height: 812 });
const sideways = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

try {
  for (const p of ["/today", "/notes", "/tasks", "/projects", "/calendar", "/habits", "/goals", "/study", "/developer", "/analytics", "/trash"]) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    assert.equal(await sideways(), false, `${p} scrolls sideways on a phone`);
  }
  step("no page scrolls sideways at 375px");

  assert.equal(await page.locator("aside").first().isVisible(), false, "desktop sidebar hidden");
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("link", { name: "Goals" }).click();
  await page.waitForURL(/\/goals$/);
  step("sidebar hidden; More opens every page (went to Goals)");

  await page.goto(`${BASE}/notes`, { waitUntil: "networkidle" });
  await page.getByText("Phone note").first().click();
  await page.locator(".ProseMirror", { hasText: "Hello from a phone" }).waitFor();
  assert.equal(await page.getByPlaceholder("Search notes...").isVisible(), false, "list hidden while a note is open");
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByPlaceholder("Search notes...").waitFor();
  step("notes: list → note → back to list, one pane at a time");

  await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
  await page.getByLabel(/Actions for A task with/).waitFor();
  step("tasks: row actions reachable on a phone");

  assert.deepEqual(errors.filter((e) => !ignorable(e)), []);
} catch (e) {
  await page.screenshot({ path: "phone-failure.png", fullPage: true });
  console.error(errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
