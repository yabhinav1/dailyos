// Runs the browser tests one after another against a running app.
//   node e2e/run.mjs               every test
//   node e2e/run.mjs tasks share   just those
// Failure screenshots land in e2e/.artifacts/.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const artifacts = path.join(dir, ".artifacts");
fs.mkdirSync(artifacts, { recursive: true });

const all = fs
  .readdirSync(path.join(dir, "tests"))
  .filter((f) => f.endsWith(".mjs"))
  .map((f) => f.replace(/\.mjs$/, ""))
  .sort();
const wanted = process.argv.slice(2);
const tests = wanted.length ? all.filter((t) => wanted.includes(t)) : all;

let failed = 0;
for (const t of tests) {
  const started = Date.now();
  console.log(`\n▶ ${t}`);
  const r = spawnSync(process.execPath, [path.join(dir, "tests", `${t}.mjs`)], { cwd: artifacts, stdio: "inherit" });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (r.status === 0) console.log(`✔ ${t} (${secs}s)`);
  else {
    failed++;
    console.log(`✘ ${t} (${secs}s)`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
