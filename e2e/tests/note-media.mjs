import assert from "node:assert/strict";
import { BASE, db, createUser, openPage } from "../harness.mjs";

const user = await createUser();
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const id = "n" + user.id;

try {
  await db.query(
    `INSERT INTO "Note"(id,"userId",title,content,"isPinned","isFavorite","createdAt","updatedAt")
     VALUES ($1,$2,'Media','<p>Hello</p>',false,false,now(),now())`,
    [id, user.id]
  );
  await page.goto(`${BASE}/notes?note=${id}`, { waitUntil: "networkidle" });
  await page.locator(".ProseMirror", { hasText: "Hello" }).waitFor();

  // A large photo: 4000x3000 noisy PNG (~>4MB), picked through the image button.
  await page.locator(".ProseMirror").click();
  const mb = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 3000; c.height = 2000;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(3000, 2000);
    for (let i = 0; i < img.data.length; i++) img.data[i] = i % 4 === 3 ? 255 : (Math.random() * 255) | 0;
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const input = document.querySelector('input[type="file"][accept="image/*"]');
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "photo.png", { type: "image/png" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return blob.size / 1048576;
  });
  console.log(`  test photo: ${mb.toFixed(1)}MB`);
  await page.locator('.ProseMirror img[src^="/api/media/"]').waitFor({ timeout: 20000 });
  step("large photo scaled down and uploaded; note holds a /api/media URL");

  // Voice note.
  await page.locator(".ProseMirror").click();
  await page.getByRole("button", { name: /Voice/ }).click();
  await sleep(1500);
  await page.getByRole("button", { name: /Stop Rec/ }).click();
  await page.locator('.ProseMirror audio[src^="/api/media/"]').waitFor({ timeout: 15000 });
  await sleep(2500);
  const content = (await db.query(`SELECT content FROM "Note" WHERE id=$1`, [id])).rows[0].content;
  assert.doesNotMatch(content, /data:/, "no inline data in the saved note");
  assert.ok(content.length < 2000, `saved note stays small (${content.length} chars)`);
  const media = (await db.query(`SELECT id, "mimeType", size, "noteId" FROM "NoteMedia" WHERE "userId"=$1`, [user.id])).rows;
  assert.equal(media.length, 2);
  assert.ok(media.every((m) => m.noteId === id));
  assert.ok(media.find((m) => m.mimeType === "image/webp").size <= 4 * 1048576);
  step(`voice note uploaded too; note is ${content.length} chars, media rows: ${media.map((m) => m.mimeType).join(", ")}`);

  // Media loads after reload, and for a signed-out visitor too (unlisted URL).
  await page.reload({ waitUntil: "networkidle" });
  const ok = await page.locator(".ProseMirror img").evaluate((img) => img.complete && img.naturalWidth > 0);
  assert.ok(ok, "image renders after reload");
  const anon = await (await import("playwright-core")).request.newContext();
  const r = await anon.get(`${BASE}/api/media/${media[0].id}`);
  assert.equal(r.status(), 200);
  assert.match(r.headers()["content-security-policy"], /sandbox/);
  assert.equal((await anon.get(`${BASE}/api/media/AAAAAAAAAAAAAAAAAAAAAA`)).status(), 404);
  step("media served by URL (200, sandboxed); unknown ids 404");

  // Upload rules.
  const up = (opts) => page.evaluate(async ({ type, body, noteId }) => {
    const f = new FormData();
    f.append("file", new File([body], "x", { type }));
    if (noteId) f.append("noteId", noteId);
    return (await fetch("/api/media", { method: "POST", body: f })).status;
  }, opts);
  assert.equal(await up({ type: "image/svg+xml", body: "<svg/>", noteId: id }), 415);
  assert.equal(await up({ type: "text/html", body: "<script>", noteId: id }), 415);
  assert.equal(await up({ type: "image/png", body: "x", noteId: "someone-elses-note" }), 404);
  assert.equal((await anon.post(`${BASE}/api/media`, { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } } })).status(), 401);
  step("rejects SVG/HTML, other people's notes, and signed-out uploads");

  // Delete forever removes the bytes.
  await db.query(`UPDATE "Note" SET "deletedAt"=now() WHERE id=$1`, [id]);
  await page.goto(`${BASE}/trash`, { waitUntil: "networkidle" });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /delete forever/i }).first().click();
  const confirm = page.getByRole("button", { name: /delete forever/i }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await sleep(2000);
  assert.equal((await db.query(`SELECT count(*)::int n FROM "NoteMedia" WHERE "userId"=$1`, [user.id])).rows[0].n, 0);
  assert.equal((await anon.get(`${BASE}/api/media/${media[0].id}`)).status(), 404);
  step("deleting the note forever removed its media rows and files");

  assert.deepEqual(errors.filter((e) => !/DevTools|favicon|HMR|Fast Refresh|script tag|status of (401|404|415)/.test(e)), []);
  console.log("MEDIA E2E PASSED");
} catch (e) {
  await page.screenshot({ path: "media-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
