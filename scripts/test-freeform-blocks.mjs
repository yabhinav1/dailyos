// Round-trip and hostile-input checks for the freeform canvas serialiser.
// Run with: node scripts/test-freeform-blocks.mjs
//
// parseBlocks is duplicated here rather than imported because the component is
// TSX and this repo has no test runner. Keep the two in step.
import assert from "node:assert/strict";

function parseBlocks(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const { id, x, y, text } = item;
      if (typeof id !== "string") return [];
      if (typeof x !== "number" || typeof y !== "number") return [];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
      return [{ id, x, y, text: typeof text === "string" ? text : "" }];
    });
  } catch {
    return [];
  }
}

const serializeBlocks = (blocks) => JSON.stringify(blocks);

// A board survives a round trip unchanged.
const board = [
  { id: "a", x: 10, y: 20, text: "hello" },
  { id: "b", x: 0, y: 0, text: "multi\nline" },
];
assert.deepEqual(parseBlocks(serializeBlocks(board)), board);

// Empty inputs are a valid empty board, not a crash.
for (const empty of [null, undefined, "", "[]"]) {
  assert.deepEqual(parseBlocks(empty), []);
}

// Anything malformed degrades to empty rather than throwing.
for (const junk of ["not json", "{}", '"a string"', "42", "null"]) {
  assert.deepEqual(parseBlocks(junk), [], `expected [] for ${junk}`);
}

// Individual bad blocks are dropped; good ones in the same array survive.
assert.deepEqual(
  parseBlocks(
    JSON.stringify([
      { id: "ok", x: 1, y: 2, text: "keep" },
      { id: 5, x: 1, y: 2 },
      { id: "nan", x: Number.NaN, y: 2 },
      { id: "missing-y", x: 1 },
      null,
      "nope",
    ])
  ),
  [{ id: "ok", x: 1, y: 2, text: "keep" }]
);

// NaN/Infinity survive JSON.stringify as null, so they must be rejected on read.
assert.deepEqual(parseBlocks('[{"id":"a","x":null,"y":0,"text":""}]'), []);

// A block with no text is legal — that is a freshly created, still-empty one.
assert.deepEqual(parseBlocks('[{"id":"a","x":0,"y":0}]'), [
  { id: "a", x: 0, y: 0, text: "" },
]);

console.log("freeform block serialiser: all checks passed");
