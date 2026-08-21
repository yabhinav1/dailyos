// Checks on the avatar data-URL parser used by /api/avatar/[userId].
// Run with: node scripts/test-avatar-data-url.mjs
import assert from "node:assert/strict";

// Mirrors the route. Keep the two in step.
function parseDataUrl(image) {
  if (!image?.startsWith("data:")) return null;
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(image);
  if (!match) return null;
  const [, contentType, base64] = match;
  if (!contentType.startsWith("image/")) return null;
  return { contentType, bytes: Buffer.from(base64, "base64") };
}

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");

// A well-formed image round-trips.
const ok = parseDataUrl(`data:image/png;base64,${png}`);
assert.equal(ok.contentType, "image/png");
assert.deepEqual([...ok.bytes], [0x89, 0x50, 0x4e, 0x47]);
assert.equal(parseDataUrl(`data:image/jpeg;base64,${png}`).contentType, "image/jpeg");

// Base64 contains "+" and "/" and is padded with "=", none of which may
// terminate the payload match.
const tricky = Buffer.from("a".repeat(200)).toString("base64");
assert.deepEqual(parseDataUrl(`data:image/png;base64,${tricky}`).bytes.toString(), "a".repeat(200));

// Newlines inside the payload are why the pattern uses [\s\S] and not "." —
// a dot would stop at the first line break and truncate the image.
assert.ok(parseDataUrl(`data:image/png;base64,${png}\n${png}`));

// Non-images are refused, so this route cannot be used to serve arbitrary
// stored content back out under a chosen content type.
assert.equal(parseDataUrl("data:text/html;base64," + Buffer.from("<script>").toString("base64")), null);
assert.equal(parseDataUrl("data:application/javascript;base64,YWxlcnQoMSk="), null);

// Anything that is not a base64 data URL at all.
for (const junk of [null, undefined, "", "https://example.com/a.png", "data:image/png,notbase64", "data:"]) {
  assert.equal(parseDataUrl(junk), null, `expected null for ${junk}`);
}

console.log("avatar data-url parser: all checks passed");
