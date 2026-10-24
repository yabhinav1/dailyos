import assert from "node:assert/strict";
import { BASE, db, createUser, openPage, MAIL, launch } from "../harness.mjs";

const step = (s) => console.log("•", s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const owner = await createUser();
const friend = await createUser();
const stranger = await createUser();
const noteId = "n" + owner.id;
await db.query(
  `INSERT INTO "Note"(id,"userId",title,content,"isPinned","isFavorite","linkAccess","createdAt","updatedAt")
   VALUES ($1,$2,'Trip plan','<p>Day 1: hike</p>',false,false,'NONE',now(),now())`,
  [noteId, owner.id]
);

const browser = await launch();
const O = await openPage(owner, { browser });
const F = await openPage(friend, { browser });
const S = await openPage(stranger, { browser });
const A = await openPage(null, { browser }); // signed out
const ignorable = (e) => /DevTools|favicon|HMR|Fast Refresh|ERR_ABORTED|401|status of 40[34]|Encountered a script tag/.test(e);

try {
  // --- Owner invites friend as editor -----------------------------------
  await O.page.goto(`${BASE}/notes?note=${noteId}`, { waitUntil: "networkidle" });
  await O.page.getByRole("button", { name: "Share", exact: true }).click();
  await O.page.getByLabel("Email address to share with").fill(friend.email.toUpperCase());
  await O.page.getByLabel("Role for new person").selectOption("EDIT");
  await O.page.getByRole("button", { name: "Share", exact: true }).last().click();
  await O.page.getByText(friend.email, { exact: true }).waitFor();
  const token = (await db.query(`SELECT "shareToken" FROM "Note" WHERE id=$1`, [noteId])).rows[0].shareToken;
  assert.ok(token && token.length >= 40);
  const share = (await db.query(`SELECT email, role FROM "NoteShare" WHERE "noteId"=$1`, [noteId])).rows[0];
  assert.deepEqual(share, { email: friend.email, role: "EDIT" }, "email stored lowercased");
  step("owner invited friend as editor");

  const mails = (await (await fetch(`${MAIL}/messages`)).json()).messages.filter((m) => m.To.some((t) => t.Address === friend.email));
  assert.equal(mails.length, 1);
  const mail = await (await fetch(`${MAIL}/message/${mails[0].ID}`)).json();
  assert.match(mail.Subject, /shared "Trip plan" with you/);
  assert.ok(mail.HTML.includes(`/s/${token}`), "invite email carries the link");
  const notif = (await db.query(`SELECT message FROM "Notification" WHERE "userId"=$1`, [friend.id])).rows;
  assert.equal(notif.length, 1);
  step("invite email (with link) + in-app notification sent");
  await O.page.keyboard.press("Escape");

  // --- Restricted link: signed out -> sign in; stranger -> no access ------
  await A.page.goto(`${BASE}/s/${token}`);
  await A.page.waitForURL(/\/login\?callbackUrl=%2Fs%2F/);
  step("restricted link sends a signed-out visitor to sign in");

  await S.page.goto(`${BASE}/s/${token}`, { waitUntil: "networkidle" });
  await S.page.getByText("You need access").waitFor();
  step("stranger signed in with another address sees 'You need access'");

  // --- Friend edits; owner sees it live -----------------------------------
  await F.page.goto(`${BASE}/s/${token}`, { waitUntil: "networkidle" });
  await F.page.getByText("Can edit").waitFor();
  await F.page.locator(".ProseMirror").click();
  await F.page.keyboard.press("End");
  await F.page.keyboard.type(" then lake swim");
  await F.page.getByText(/All changes saved/).waitFor({ timeout: 10000 });
  let row = (await db.query(`SELECT content, "lastEditedBy" FROM "Note" WHERE id=$1`, [noteId])).rows[0];
  assert.match(row.content, /lake swim/);
  assert.match(row.lastEditedBy, /^E2E /);
  step("friend's edit saved, attributed to them");

  await O.page.locator(".ProseMirror", { hasText: "lake swim" }).waitFor({ timeout: 10000 });
  await O.page.getByText(/last edit by E2E/).waitFor();
  step("owner's open editor picked up the friend's edit within seconds");

  // --- Owner edits; friend sees it ----------------------------------------
  await O.page.locator(".ProseMirror").click();
  await O.page.keyboard.press("Control+End");
  await O.page.keyboard.press("Enter");
  await O.page.keyboard.type("Day 2: museum");
  await sleep(2500);
  await F.page.locator(".ProseMirror", { hasText: "Day 2: museum" }).waitFor({ timeout: 10000 });
  step("friend's view picked up the owner's edit");

  // --- Conflict: someone saves underneath a typing editor -----------------
  await db.query(`UPDATE "Note" SET content='<p>Rewritten by owner elsewhere</p>', "lastEditedBy"='Owner tab 2', "updatedAt"=now() WHERE id=$1`, [noteId]);
  await F.page.locator(".ProseMirror").click();
  await F.page.keyboard.type(" plus picnic");
  await F.page.getByRole("alert").getByText(/changed this note while you were editing/).waitFor({ timeout: 10000 });
  step("simultaneous edit -> conflict prompt instead of silent overwrite");
  await F.page.getByRole("button", { name: "Keep mine" }).click();
  await F.page.getByText(/All changes saved/).waitFor({ timeout: 10000 });
  row = (await db.query(`SELECT content FROM "Note" WHERE id=$1`, [noteId])).rows[0];
  assert.match(row.content, /plus picnic/);
  step("'Keep mine' saved the friend's version on top");

  // --- Downgrade to viewer: friend's page turns read-only -----------------
  await db.query(`UPDATE "NoteShare" SET role='VIEW' WHERE "noteId"=$1`, [noteId]);
  await F.page.getByText("View only").waitFor({ timeout: 10000 });
  assert.equal(await F.page.locator(".ProseMirror").getAttribute("contenteditable"), "false");
  step("role change to viewer applied live (read-only editor)");

  // Viewer can't save even by calling the action directly: verified by the
  // server check; here make sure typing doesn't change the DB.
  const before = (await db.query(`SELECT "updatedAt" FROM "Note" WHERE id=$1`, [noteId])).rows[0].updatedAt.getTime();
  await F.page.locator(".ProseMirror").click();
  await F.page.keyboard.type("hack");
  await sleep(1500);
  const after = (await db.query(`SELECT "updatedAt" FROM "Note" WHERE id=$1`, [noteId])).rows[0].updatedAt.getTime();
  assert.equal(after, before, "viewer typing changes nothing");
  step("viewer cannot change the note");

  // --- Shared with me ------------------------------------------------------
  await F.page.goto(`${BASE}/notes`, { waitUntil: "networkidle" });
  await F.page.getByText("Shared with me").waitFor();
  await F.page.getByRole("link", { name: /Trip plan/ }).waitFor();
  step("note listed under 'Shared with me' for the friend");

  // --- Anyone with the link ------------------------------------------------
  await O.page.getByRole("button", { name: "Shared", exact: true }).click();
  await O.page.getByLabel("General access").selectOption("ANYONE");
  await sleep(800);
  await A.page.goto(`${BASE}/s/${token}`, { waitUntil: "networkidle" });
  await A.page.getByText("View only").waitFor();
  step("anyone-with-link (viewer): signed-out visitor can read");
  await O.page.getByLabel("Link access role").selectOption("EDIT");
  await sleep(800);
  await A.page.reload({ waitUntil: "networkidle" });
  await A.page.getByText("Can edit").waitFor();
  await A.page.locator(".ProseMirror").click();
  await A.page.keyboard.type(" anon");
  await A.page.getByText(/All changes saved/).waitFor({ timeout: 10000 });
  assert.equal((await db.query(`SELECT "lastEditedBy" FROM "Note" WHERE id=$1`, [noteId])).rows[0].lastEditedBy, "Anonymous");
  step("anyone-with-link (editor): signed-out visitor can edit, shown as Anonymous");

  // --- Reset link revokes the old one --------------------------------------
  O.page.once("dialog", () => {});
  await O.page.getByRole("button", { name: /Reset link/ }).click();
  await O.page.getByRole("button", { name: "Reset link" }).last().click();
  await sleep(1000);
  const newToken = (await db.query(`SELECT "shareToken" FROM "Note" WHERE id=$1`, [noteId])).rows[0].shareToken;
  assert.notEqual(newToken, token);
  const old = await A.page.goto(`${BASE}/s/${token}`);
  assert.equal(old.status(), 404);
  step("reset link: old link now 404s");

  // --- Trashing closes the link --------------------------------------------
  await db.query(`UPDATE "Note" SET "deletedAt"=now() WHERE id=$1`, [noteId]);
  assert.equal((await A.page.goto(`${BASE}/s/${newToken}`)).status(), 404);
  await db.query(`UPDATE "Note" SET "deletedAt"=NULL WHERE id=$1`, [noteId]);
  step("a trashed note's link stops working");

  // --- Owner following own link lands in the editor ------------------------
  await O.page.goto(`${BASE}/s/${newToken}`);
  await O.page.waitForURL(/\/notes\?note=/);
  step("owner opening the link is taken to their editor");

  for (const [who, p] of [["owner", O], ["friend", F], ["stranger", S], ["anon", A]]) {
    const bad = p.errors.filter((e) => !ignorable(e));
    assert.deepEqual(bad, [], `${who} page errors`);
  }
  console.log("SHARE E2E PASSED");
} catch (e) {
  for (const [n, p] of [["owner", O], ["friend", F], ["anon", A]]) {
    await p.page.screenshot({ path: `share-${n}.png`, fullPage: true }).catch(() => {});
    console.error(n, "errors:", p.errors.slice(0, 5));
  }
  throw e;
} finally {
  await browser.close();
  await db.end();
}
