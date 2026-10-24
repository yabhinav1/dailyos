import assert from "node:assert/strict";
import { BASE, db, createUser, openPage, MAIL } from "../harness.mjs";

const user = await createUser();
const { browser, page, errors } = await openPage(user);
const step = (s) => console.log("•", s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // --- Settings tabs, after the split --------------------------------------
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  for (const tab of ["Account", "Security", "Preferences", "Data", "Profile"]) {
    await page.getByRole("button", { name: tab, exact: true }).first().click();
    await sleep(300);
  }
  await page.getByRole("button", { name: "Data", exact: true }).first().click();
  await page.getByText("Request your data").waitFor();
  await page.getByRole("button", { name: "Email my data" }).click();
  await page.getByText(/sent|Export/i).first().waitFor();
  await sleep(1500);
  const mails = (await (await fetch(`${MAIL}/messages`)).json()).messages.filter((m) => m.To.some((t) => t.Address === user.email));
  assert.ok(mails.some((m) => /data export/i.test(m.Subject)), "export email arrived");
  step("settings: every tab renders; Data tab export still emails the JSON");
  await page.getByRole("button", { name: /Delete my account/ }).click();
  await page.getByText("Schedule this account for deletion?").waitFor();
  await page.getByRole("button", { name: "Keep it" }).click();
  step("settings: delete confirmation opens and cancels");

  await page.getByRole("button", { name: "Preferences", exact: true }).first().click();
  await page.getByText(/A morning email and notification/).waitFor();
  step("settings: preferences shows the reminders description");

  // --- Notes: folders, export menu, history --------------------------------
  await page.goto(`${BASE}/notes`, { waitUntil: "networkidle" });
  await page.getByLabel("New folder").click();
  await page.getByPlaceholder("Folder name").fill("Work");
  await page.keyboard.press("Enter");
  await page.getByText("Work", { exact: true }).waitFor();
  step("notes: create folder through the extracted nav");

  await page.getByRole("button", { name: "New Note" }).last().click();
  await page.locator(".ProseMirror").waitFor();
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("First draft");
  await sleep(2000);
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Second draft");
  await sleep(2000);

  await page.getByRole("button", { name: /Export/ }).click();
  await page.getByText("Export Note As").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Export/ }).click();
  step("notes: export menu opens");

  await page.getByTitle("View Note Revision History").click();
  const dialog = page.getByRole("dialog", { name: "Revision history" });
  await dialog.waitFor();
  // A brand-new note has no earlier versions yet (one is kept per editing
  // session after a ten-minute break); e2e/tests/note-history.mjs covers that.
  await dialog.getByText("No earlier versions yet").waitFor();
  step("notes: version history opens from the footer");

  assert.deepEqual(errors.filter((e) => !/DevTools|favicon|HMR|Fast Refresh|script tag/.test(e)), []);
  console.log("REFACTOR E2E PASSED");
} catch (e) {
  await page.screenshot({ path: "refactor-failure.png", fullPage: true });
  console.error("errors:", errors);
  throw e;
} finally {
  await browser.close();
  await db.end();
}
