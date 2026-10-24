// Shared setup for the browser tests: a user in the test database, a signed-in
// browser page for them, and the URLs of the app and the test mail server.
//
// Point these at throwaway services only. The tests create users and data
// freely and never clean up. Defaults match the local Docker setup in
// e2e/README.md; CI sets them in .github/workflows/e2e.yml.
import pg from "pg";
import { encode } from "next-auth/jwt";
import { chromium } from "playwright-core";

export const BASE = process.env.E2E_BASE_URL || "http://localhost:3100";
export const MAIL = process.env.E2E_MAIL_API || "http://localhost:8025/api/v1";
export const CRON_SECRET = process.env.CRON_SECRET || "local-cron";
export const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET || "scheduler-test";
const DB = process.env.E2E_DATABASE_URL || "postgresql://postgres:dev@localhost:54329/dailyos";
const SECRET = process.env.AUTH_SECRET || "local-dev-secret-not-for-production-0123456789";
// Unset in CI, where Playwright's own Chromium is installed.
const CHROME = process.env.E2E_CHROME_PATH ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);

if (/neon\.tech|amazonaws|supabase/.test(DB)) throw new Error("Refusing to run the browser tests against a hosted database.");

// Prisma stores DateTime as timestamp-without-zone holding UTC; read it as UTC.
pg.types.setTypeParser(1114, (s) => new Date(s.replace(" ", "T") + "Z"));
export const db = new pg.Client({ connectionString: DB });
await db.connect();

export const step = (s) => console.log("  •", s);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Browser messages that are expected and not failures. */
export const ignorable = (e) =>
  /Download the React DevTools|favicon|\[HMR\]|Fast Refresh|Encountered a script tag/.test(e);

export async function createUser(tz = "Asia/Kolkata") {
  const id = "e2e" + Math.random().toString(36).slice(2, 10);
  const email = `${id}@example.test`;
  await db.query(
    `INSERT INTO "User"(id, email, name, "emailVerified", "createdAt", "updatedAt") VALUES ($1,$2,$3,now(),now(),now())`,
    [id, email, "E2E " + id]
  );
  await db.query(
    `INSERT INTO "UserSettings"(id, "userId", "onboardedAt", timezone, "updatedAt") VALUES ($1,$2,now(),$3,now())`,
    ["s" + id, id, tz]
  );
  const token = await encode({ token: { sub: id, name: "E2E " + id, email }, secret: SECRET, salt: "authjs.session-token" });
  return { id, email, token };
}

export async function launch() {
  return chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
}

/** A page signed in as `user` (or signed out for null), in India's time zone. */
export async function openPage(user, { timezoneId = "Asia/Kolkata", browser: shared } = {}) {
  const browser = shared ?? (await launch());
  const context = await browser.newContext({
    timezoneId,
    viewport: { width: 1400, height: 900 },
    permissions: ["microphone", "clipboard-read", "clipboard-write"],
  });
  if (user) await context.addCookies([{ name: "authjs.session-token", value: user.token, url: BASE }]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  return { browser, page, errors };
}

/** Today's date (YYYY-MM-DD) in a time zone, default India. */
export const dayIn = (tz = "Asia/Kolkata", offsetDays = 0) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  return new Date(Date.parse(today + "T00:00:00Z") + offsetDays * 86400000).toISOString().slice(0, 10);
};
