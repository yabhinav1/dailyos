import assert from "node:assert/strict";
import { BASE, db, createUser, openPage } from "../harness.mjs";

const user = await createUser();
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const id = "n" + user.id;
  await db.query(
    `INSERT INTO "Note"(id,"userId",title,content,"isPinned","isFavorite","createdAt","updatedAt")
     VALUES ($1,$2,'Weekly','<p>Notes from the call</p><p>[ ] Send the deck</p><p>TODO: book flights</p><ul><li><p>Ask Sam about budget</p></li></ul><p>Just a thought</p>',false,false,now() - interval '2 days',now() - interval '2 days')`,
    [id, user.id]
  );
  const before = (await db.query(`SELECT "updatedAt" FROM "Note" WHERE id=$1`, [id])).rows[0].updatedAt.getTime();

  // Opening a note must not save it.
  await page.goto(`${BASE}/notes?note=${id}`, { waitUntil: "networkidle" });
  await page.locator(".ProseMirror", { hasText: "Send the deck" }).waitFor();
  await sleep(2500);
  const after = (await db.query(`SELECT "updatedAt" FROM "Note" WHERE id=$1`, [id])).rows[0].updatedAt.getTime();
  assert.equal(after, before, "opening a note left updatedAt alone");
  step("opening a note no longer saves it");

  // Turn into tasks (no OPENAI_API_KEY locally -> marker fallback).
  await page.getByRole("button", { name: /AI & Language/ }).click();
  await page.getByRole("button", { name: "Turn into Tasks" }).click();
  await page.getByText("Create tasks from this note").waitFor();
  const boxes = page.getByRole("dialog").getByRole("checkbox");
  assert.equal(await boxes.count(), 3, "two marked items + one bullet");
  assert.equal(await boxes.nth(0).isChecked(), true);
  assert.equal(await boxes.nth(1).isChecked(), true);
  assert.equal(await boxes.nth(2).isChecked(), false, "plain bullet offered unticked");
  await page.getByRole("button", { name: "Create 2 tasks" }).click();
  await page.getByText("Created 2 tasks.").waitFor();
  const titles = (await db.query(`SELECT title FROM "Task" WHERE "userId"=$1 `, [user.id])).rows.map((r) => r.title).sort();
  assert.deepEqual(titles, ["Send the deck", "book flights"]);
  step("Turn into Tasks: review dialog, created the 2 ticked tasks");

  // Voice note survives a reload.
  await page.locator(".ProseMirror").click();
  await page.keyboard.press("Control+End");
  await page.getByRole("button", { name: /Voice/ }).click();
  await sleep(1500);
  await page.getByRole("button", { name: /Stop Rec/ }).click();
  await page.locator(".ProseMirror audio").waitFor({ timeout: 5000 });
  await sleep(2500);
  const saved = (await db.query(`SELECT content FROM "Note" WHERE id=$1`, [id])).rows[0].content;
  // File storage when MongoDB is configured, inline when it isn't.
  assert.match(saved, /<audio[^>]+src="(\/api\/media\/|data:audio\/)/, "recording saved with the note");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".ProseMirror audio").waitFor({ timeout: 10000 });
  step("voice note saved as data URL and still there after reload");

  assert.deepEqual(errors.filter((e) => !/DevTools|favicon|HMR|Fast Refresh/.test(e)), []);
  console.log("NOTES EXTRAS E2E PASSED");
} catch (e) {
  await page.screenshot({ path: "notes-extras-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
