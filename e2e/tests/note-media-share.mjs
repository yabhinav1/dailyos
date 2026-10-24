import assert from "node:assert/strict";
import { request } from "playwright-core";
import { BASE, db, createUser } from "../harness.mjs";
const u = await createUser();
const tok = (s) => s.repeat(43).slice(0, 43);
await db.query(`INSERT INTO "Note"(id,"userId",title,content,"isPinned","isFavorite","linkAccess","shareToken","createdAt","updatedAt") VALUES ($1,$2,'e','',false,false,'EDIT',$3,now(),now()),($4,$2,'v','',false,false,'VIEW',$5,now(),now())`,
  ["e" + u.id, u.id, tok("E" + u.id), "v" + u.id, tok("V" + u.id)]);
const anon = await request.newContext();
const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
const send = (t) => anon.post(`${BASE}/api/media`, { multipart: { shareToken: t, file: { name: "a.png", mimeType: "image/png", buffer: png } } });
const r1 = await send(tok("E" + u.id));
assert.equal(r1.status(), 200);
const row = (await db.query(`SELECT "userId","noteId" FROM "NoteMedia" WHERE "noteId"=$1`, ["e" + u.id])).rows[0];
assert.deepEqual(row, { userId: u.id, noteId: "e" + u.id });
assert.equal((await send(tok("V" + u.id))).status(), 403);
console.log("• anonymous link editor can upload (owned by note owner); viewer link gets 403\nMEDIA SHARE PASSED");
await db.end();
