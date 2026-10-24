import assert from "node:assert/strict";
import { BASE, db, createUser, openPage, MAIL, launch } from "../harness.mjs";

const step = (s) => console.log("•", s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const owner = await createUser();
const friend = await createUser();
const pid = "p" + owner.id;
await db.query(`INSERT INTO "Project"(id,"userId",name,description,"isCompleted","linkAccess","createdAt","updatedAt") VALUES ($1,$2,'Garden','Spring planting',false,'NONE',now(),now())`, [pid, owner.id]);
await db.query(
  `INSERT INTO "Task"(id,"userId","projectId",title,priority,status,"actualTime","isFavorite",recurrence,"dueDate","createdAt","updatedAt") VALUES
   ($1,$3,$4,'Buy seeds','HIGH','TODO',0,false,NULL,NULL,now(),now()),
   ($2,$3,$4,'Water beds','MEDIUM','TODO',0,false,'DAILY',(now()::date)::timestamp,now(),now())`,
  ["t1" + owner.id, "t2" + owner.id, owner.id, pid]
);
await db.query(`INSERT INTO "Milestone"(id,"projectId",title,"isCompleted","createdAt","updatedAt") VALUES ($1,$2,'Beds ready',false,now(),now())`, ["m" + owner.id, pid]);

const browser = await launch();
const O = await openPage(owner, { browser });
const F = await openPage(friend, { browser });
const A = await openPage(null, { browser });
const ignorable = (e) => /DevTools|favicon|HMR|Fast Refresh|script tag|status of 40[134]/.test(e);

try {
  await O.page.goto(`${BASE}/projects`, { waitUntil: "networkidle" });
  await O.page.getByLabel("Actions for Garden").click();
  await O.page.getByRole("menuitem", { name: "Share" }).click();
  await O.page.getByLabel("Email address to share with").fill(friend.email);
  await O.page.getByRole("button", { name: "Share", exact: true }).last().click();
  await O.page.getByText(friend.email, { exact: true }).waitFor();
  const token = (await db.query(`SELECT "shareToken" FROM "Project" WHERE id=$1`, [pid])).rows[0].shareToken;
  const mail = (await (await fetch(`${MAIL}/messages`)).json()).messages.find((m) => m.To.some((t) => t.Address === friend.email));
  assert.match(mail.Subject, /shared "Garden" with you/);
  step("owner invited friend as editor; email sent");
  await O.page.keyboard.press("Escape");

  // Restricted: signed-out -> login.
  await A.page.goto(`${BASE}/p/${token}`);
  await A.page.waitForURL(/\/login\?callbackUrl=%2Fp%2F/);
  step("restricted project link sends signed-out visitor to sign in");

  // Friend: sees project, ticks the repeating task -> next copy appears; owner's goal side effects run.
  await F.page.goto(`${BASE}/p/${token}`, { waitUntil: "networkidle" });
  await F.page.getByText("Can edit").waitFor();
  await F.page.getByText("Spring planting").waitFor();
  await F.page.getByLabel('Mark "Water beds" done').click();
  await sleep(2000);
  const waters = (await db.query(`SELECT status FROM "Task" WHERE "projectId"=$1 AND title='Water beds' AND "deletedAt" IS NULL ORDER BY "createdAt"`, [pid])).rows;
  assert.deepEqual(waters.map((w) => w.status), ["COMPLETED", "TODO"], "repeating task's next copy created for the owner");
  step("editor ticked a repeating task; its next occurrence was created");

  await F.page.getByLabel('Mark "Beds ready" done').click();
  await F.page.getByLabel("New task").fill("Order mulch");
  await F.page.getByRole("button", { name: "Add" }).click();
  await F.page.getByText("Order mulch").waitFor();
  const added = (await db.query(`SELECT "userId" FROM "Task" WHERE title='Order mulch' AND "projectId"=$1`, [pid])).rows[0];
  assert.equal(added.userId, owner.id, "new task belongs to the owner");
  assert.equal((await db.query(`SELECT "isCompleted" FROM "Milestone" WHERE id=$1`, ["m" + owner.id])).rows[0].isCompleted, true);
  step("editor ticked a milestone and added a task (owned by the owner)");

  // Owner sees the changes in their own task list.
  await O.page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
  await O.page.getByText("Order mulch").first().waitFor();
  step("owner's Tasks page shows the task the editor added");

  // Owner's "Open" goes to the project page, and the friend's view live-updates.
  await O.page.goto(`${BASE}/projects`, { waitUntil: "networkidle" });
  await O.page.getByRole("button", { name: "Garden", exact: true }).click();
  await O.page.waitForURL(/\/p\//);
  await O.page.getByText("Owner", { exact: true }).waitFor();
  await O.page.getByLabel('Mark "Buy seeds" done').click();
  await F.page.locator("li", { hasText: "Buy seeds" }).locator(".line-through").waitFor({ timeout: 10000 });
  step("owner opened the project page; friend's view updated within seconds");

  // Viewer: read-only.
  await db.query(`UPDATE "ProjectShare" SET role='VIEW' WHERE "projectId"=$1`, [pid]);
  await F.page.getByText("View only").waitFor({ timeout: 10000 });
  assert.equal(await F.page.getByLabel("New task").count(), 0);
  assert.equal(await F.page.getByLabel('Mark "Order mulch" done').isDisabled(), true);
  step("downgrade to viewer applied live: no add box, ticks disabled");

  // Shared with me.
  await F.page.goto(`${BASE}/projects`, { waitUntil: "networkidle" });
  await F.page.getByText("Shared with me").waitFor();
  await F.page.getByRole("link", { name: /Garden/ }).waitFor();
  step("project listed under 'Shared with me'");

  // Trashing the project closes its link.
  await db.query(`UPDATE "Project" SET "deletedAt"=now() WHERE id=$1`, [pid]);
  assert.equal((await A.page.goto(`${BASE}/p/${token}`)).status(), 404);
  step("trashed project's link 404s");

  for (const [n, p] of [["owner", O], ["friend", F], ["anon", A]]) assert.deepEqual(p.errors.filter((e) => !ignorable(e)), [], n);
  console.log("PROJECT SHARE E2E PASSED");
} catch (e) {
  for (const [n, p] of [["owner", O], ["friend", F]]) {
    await p.page.screenshot({ path: `pshare-${n}.png`, fullPage: true }).catch(() => {});
    console.error(n, p.errors.slice(0, 4));
  }
  throw e;
} finally {
  await browser.close();
  await db.end();
}
