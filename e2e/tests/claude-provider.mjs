import assert from "node:assert/strict";
import fs from "node:fs";
// Only meaningful with the app pointed at e2e/mock-claude.mjs (see there).
if (!process.env.E2E_CLAUDE_MOCK_LOG) {
  console.log("  (skipped: set E2E_CLAUDE_MOCK_LOG and run the app against e2e/mock-claude.mjs)");
  process.exit(0);
}
const { BASE, db, createUser, openPage } = await import("../harness.mjs");

const user = await createUser();
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);
const id = "n" + user.id;

try {
  await db.query(
    `INSERT INTO "Note"(id,"userId",title,content,"isPinned","isFavorite","createdAt","updatedAt")
     VALUES ($1,$2,'Offsite','<p>We should email Priya the budget by Thursday and book a venue.</p>',false,false,now(),now())`,
    [id, user.id]
  );
  await page.goto(`${BASE}/notes?note=${id}`, { waitUntil: "networkidle" });
  await page.locator(".ProseMirror", { hasText: "Priya" }).waitFor();

  await page.getByRole("button", { name: /AI & Language/ }).click();
  await page.getByRole("button", { name: "Turn into Tasks" }).click();
  await page.getByText("Found by AI.").waitFor();
  const dlg = page.getByRole("dialog");
  await dlg.getByText("Email Priya the budget").waitFor();
  await dlg.getByText("high priority").waitFor();
  await page.getByRole("button", { name: "Create 2 tasks" }).click();
  await page.getByText("Created 2 tasks.").waitFor();
  const t = (await db.query(`SELECT title, priority, "dueDate" FROM "Task" WHERE "userId"=$1 ORDER BY title`, [user.id])).rows;
  assert.equal(t.length, 2);
  const email = t.find((x) => x.title === "Email Priya the budget");
  assert.equal(email.priority, "HIGH");
  assert.equal(email.dueDate.toISOString().slice(0, 10), "2026-10-30");
  step("Turn into Tasks via Claude: fenced JSON reply parsed, due date and priority kept");

  await page.getByRole("button", { name: /AI & Language/ }).click();
  await page.getByRole("button", { name: "Executive Summary" }).click();
  await page.locator(".ProseMirror", { hasText: "Plan the offsite" }).waitFor();
  step("Executive Summary via Claude inserted into the note");

  const log = fs.readFileSync(process.env.E2E_CLAUDE_MOCK_LOG, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.ok(log.length >= 2 && log.every((l) => l.ok), "every request had the right headers and shape");
  assert.ok(log.every((l) => l.model === "claude-sonnet-5-5"));
  step(`Messages API requests well-formed (${log.length}), model ${log[0].model}`);

  assert.deepEqual(errors.filter((e) => !/DevTools|favicon|HMR|Fast Refresh|script tag/.test(e)), []);
  console.log("CLAUDE E2E PASSED");
} catch (e) {
  await page.screenshot({ path: "claude-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
