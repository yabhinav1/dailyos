import assert from "node:assert/strict";
import { BASE, db, createUser, openPage } from "../harness.mjs";

const user = await createUser();
const other = await createUser();
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);

try {
  await db.query(
    `INSERT INTO "Note"(id,"userId",title,content,"isPinned","isFavorite","createdAt","updatedAt")
     VALUES ($1,$2,'Trip plan','<p>Book the <b>kayak</b> rental early</p>',false,false,now(),now()),
            ($3,$4,'Secret kayak note','<p>someone else</p>',false,false,now(),now())`,
    ["n" + user.id, user.id, "n" + other.id, other.id]
  );
  await db.query(
    `INSERT INTO "Task"(id,"userId",title,priority,status,"actualTime","isFavorite","createdAt","updatedAt")
     VALUES ($1,$2,'Return kayak paddles','MEDIUM','TODO',0,false,now(),now())`,
    ["t" + user.id, user.id]
  );

  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search" }).fill("kayak");
  await page.getByRole("option", { name: /Trip plan/ }).waitFor();
  await page.getByRole("option", { name: /Return kayak paddles/ }).waitFor();
  assert.equal(await page.getByRole("option", { name: /Secret kayak note/ }).count(), 0, "other users' notes never appear");
  assert.match(await page.getByRole("option", { name: /Trip plan/ }).innerText(), /kayak rental/);
  step("finds own note (with snippet) and task, not another user's note");

  // Keyboard: first result is highlighted; Enter opens the note.
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/notes\?note=/);
  await page.locator("input[value='Trip plan'], textarea").first().waitFor();
  const titleValue = await page.locator("input").evaluateAll((els) => els.map((e) => e.value));
  assert.ok(titleValue.includes("Trip plan"), "note opened in the editor");
  step("Enter opens the note in the editor");

  // Arrow down to the task, Enter -> tasks page filtered.
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search" }).fill("kayak");
  await page.getByRole("option", { name: /Return kayak paddles/ }).waitFor();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/tasks\?q=/);
  assert.equal(await page.getByPlaceholder("Search tasks...").inputValue(), "Return kayak paddles");
  step("ArrowDown + Enter opens tasks filtered to it");

  // Create-task action.
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search" }).fill("Buy lifejacket");
  await page.getByRole("option", { name: /Create task "Buy lifejacket"/ }).click();
  await page.waitForTimeout(1500);
  assert.equal((await db.query(`SELECT count(*)::int n FROM "Task" WHERE title='Buy lifejacket' AND "userId"=$1`, [user.id])).rows[0].n, 1);
  step("create-task action works");

  assert.deepEqual(errors.filter((e) => !/DevTools|favicon|HMR|Fast Refresh/.test(e)), []);
  console.log("SEARCH E2E PASSED");
} catch (e) {
  await page.screenshot({ path: "search-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
