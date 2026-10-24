import assert from "node:assert/strict";
import { BASE, db, createUser, openPage } from "../harness.mjs";

const user = await createUser();
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const id = "n" + user.id;
const revs = async () => (await db.query(`SELECT title, content, "savedAt" FROM "NoteRevision" WHERE "noteId"=$1 ORDER BY "savedAt"`, [id])).rows;

try {
  await db.query(
    `INSERT INTO "Note"(id,"userId",title,content,"isPinned","isFavorite","createdAt","updatedAt")
     VALUES ($1,$2,'Plan','<p>Version one</p>',false,false,now() - interval '1 day',now() - interval '1 day')`,
    [id, user.id]
  );
  await page.goto(`${BASE}/notes?note=${id}`, { waitUntil: "networkidle" });
  await page.locator(".ProseMirror", { hasText: "Version one" }).waitFor();
  assert.equal((await revs()).length, 0, "opening keeps nothing");

  await page.locator(".ProseMirror").click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Version two");
  await sleep(2500);
  await page.keyboard.type(" plus more");
  await sleep(2500);
  let r = await revs();
  assert.equal(r.length, 1, "one version kept for the whole editing session");
  assert.match(r[0].content, /Version one/);
  step("editing after a long gap kept the previous version once, not per save");

  await page.reload({ waitUntil: "networkidle" });
  await page.getByTitle("View Note Revision History").click();
  const dialog = page.getByRole("dialog", { name: "Revision history" });
  await dialog.getByRole("button", { name: "Restore" }).first().waitFor();
  assert.equal(await dialog.getByRole("button", { name: "Restore" }).count(), 1);
  step("history survives a reload");

  await dialog.getByRole("button", { name: "Restore" }).first().click();
  await page.locator(".ProseMirror", { hasText: "Version one" }).waitFor();
  await sleep(1500);
  const now = (await db.query(`SELECT content FROM "Note" WHERE id=$1`, [id])).rows[0].content;
  assert.match(now, /Version one/);
  r = await revs();
  assert.equal(r.length, 2, "restore kept the replaced version");
  assert.match(r[1].content, /Version two plus more/);
  step("restore puts the old version back and keeps the replaced one");

  assert.deepEqual(errors.filter((e) => !/DevTools|favicon|HMR|Fast Refresh|script tag/.test(e)), []);
  console.log("HISTORY E2E PASSED");
} catch (e) {
  await page.screenshot({ path: "history-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
