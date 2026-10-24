import assert from "node:assert/strict";
import { BASE, db, createUser, openPage } from "../harness.mjs";

const user = await createUser();
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);

try {
  await page.goto(`${BASE}/developer`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New Project" }).click();
  await page.getByPlaceholder("e.g. DailyOS Productivity").fill("Side project");
  await page.getByPlaceholder("React, Node, Prisma, PostgreSQL").fill("Next, Prisma");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page.getByText("Side project").first().waitFor();
  step("created coding project");

  await page.getByRole("button", { name: /Issues & Releases/ }).click();
  await page.getByRole("button", { name: "New Issue" }).click();
  await page.getByPlaceholder("e.g. Login redirect loops on Safari").fill("Crash on save");
  await page.getByRole("button", { name: "Log Issue" }).click();
  await page.getByText("Crash on save").waitFor();
  step("logged issue");

  await page.getByLabel("Status of Crash on save").selectOption("RESOLVED");
  await page.waitForTimeout(1500);
  const issue = (await db.query(
    `SELECT i.status, i.priority, i.type FROM "DeveloperIssue" i JOIN "CodingProject" p ON p.id=i."codingProjectId" WHERE p."userId"=$1`,
    [user.id]
  )).rows[0];
  assert.deepEqual(issue, { status: "RESOLVED", priority: "MEDIUM", type: "BUG" }, "status change kept other fields");
  step("status change saved without resetting other fields");

  await page.getByRole("button", { name: /Releases/ }).last().click();
  await page.getByRole("button", { name: /New Release|Add Release|Log Release/ }).first().click();
  await page.getByPlaceholder("e.g. 1.2.0").fill("0.1.0");
  await page.getByPlaceholder("e.g. Offline mode").fill("First cut");
  await page.locator("form").getByRole("button").last().click();
  await page.getByText("First cut").waitFor();
  step("added release");

  assert.deepEqual(errors.filter((e) => !/DevTools|favicon|HMR|Fast Refresh/.test(e)), []);
  console.log("DEVELOPER E2E PASSED");
} catch (e) {
  await page.screenshot({ path: "developer-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
