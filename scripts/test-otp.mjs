// Checks on the one-time-code helpers. Run with: node scripts/test-otp.mjs
//
// Mirrors src/lib/otp.ts, which is TypeScript and has no test runner here.
// Keep the two in step.
import assert from "node:assert/strict";
import { randomInt, timingSafeEqual } from "node:crypto";

const generateOtp = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

function otpMatches(expected, provided) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Always exactly six digits — including the low numbers that a naive
// `Math.floor(x * 900000) + 100000` never produces and a bare toString()
// would emit as "42" rather than "000042".
const codes = Array.from({ length: 3000 }, generateOtp);
for (const c of codes) {
  assert.match(c, /^[0-9]{6}$/, `bad code: ${c}`);
}

// The whole space is reachable, not just 100000-999999. Leading-zero codes are
// ~10% of the range, so 3000 draws missing them entirely would be conclusive.
assert.ok(
  codes.some((c) => c.startsWith("0")),
  "no leading-zero codes in 3000 draws — the low range is unreachable"
);

// Spread across the range rather than clustered.
assert.ok(new Set(codes).size > 2900, "excessive collisions for a 1e6 space");

// Matching is exact.
assert.equal(otpMatches("123456", "123456"), true);
assert.equal(otpMatches("123456", "123457"), false);
assert.equal(otpMatches("000042", "000042"), true);

// A length mismatch returns false rather than throwing — timingSafeEqual
// rejects unequal buffers, so the guard has to come first.
assert.equal(otpMatches("123456", ""), false);
assert.equal(otpMatches("123456", "12345"), false);
assert.equal(otpMatches("123456", "1234567"), false);

// "000042" and "42" are different codes; no numeric coercion anywhere.
assert.equal(otpMatches("000042", "42"), false);

console.log(`otp helpers: all checks passed (${codes.length} codes sampled)`);
