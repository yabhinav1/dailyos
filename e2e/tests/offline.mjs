import assert from "node:assert/strict";
import { BASE, db, createUser, openPage } from "../harness.mjs";

const user = await createUser();
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);
const cspViolations = new Set();
page.on("console", (m) => {
  if (/Content Security Policy|Content-Security-Policy/i.test(m.text())) cspViolations.add(m.text().slice(0, 220));
});

try {
  // Walk the app so CSP report-only violations surface.
  for (const p of ["/today", "/notes", "/tasks", "/calendar", "/habits", "/goals", "/projects", "/developer", "/study", "/analytics", "/trash", "/settings"]) {
    await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
  }
  step("visited every page in production mode");

  await page.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  const swReady = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  assert.ok(swReady, "service worker active");
  step("service worker registered and active");

  // Drop the connection: banner appears.
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByText("You're offline").waitFor({ timeout: 10000 });
  step("offline banner shows");

  await page.context().setOffline(false);

  console.log("CSP report-only violations:", cspViolations.size ? [...cspViolations] : "none");
  console.log("OFFLINE E2E PASSED");
} catch (e) {
  await page.screenshot({ path: "offline-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
