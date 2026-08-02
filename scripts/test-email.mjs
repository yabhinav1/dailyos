/**
 * Sends a real test email through the configured SMTP provider (ZeptoMail).
 *
 *   node scripts/test-email.mjs you@example.com
 *
 * Verifies the connection first, so bad credentials fail fast with a clear
 * message instead of a silent non-delivery.
 */
import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";

// Load .env.local without pulling in a dotenv dependency.
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!match) continue;
  const value = match[2].trim().replace(/^"(.*)"$/s, "$1").replace(/^'(.*)'$/s, "$1");
  if (!(match[1] in process.env)) process.env[match[1]] = value;
}

const to = process.argv[2];
if (!to) {
  console.error("Usage: node scripts/test-email.mjs <recipient@example.com>");
  process.exit(1);
}

if (!process.env.SMTP_PASSWORD || process.env.SMTP_PASSWORD === "PASTE_ZEPTOMAIL_SMTP_TOKEN_HERE") {
  console.error("SMTP_PASSWORD is still the placeholder. Paste your ZeptoMail Send Mail token into .env.local first.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "465", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
});

console.log(`Connecting to ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} as ${process.env.SMTP_USER}...`);
await transporter.verify();
console.log("Credentials accepted.");

const info = await transporter.sendMail({
  from: process.env.SMTP_FROM,
  to,
  subject: "DailyOS SMTP test",
  text: "If you're reading this, ZeptoMail is wired up correctly.",
  html: "<p>If you're reading this, <strong>ZeptoMail is wired up correctly</strong>.</p>",
});

console.log(`Sent to ${to} — message id ${info.messageId}`);
console.log(`Server response: ${info.response}`);
