import nodemailer from "nodemailer";

const PLACEHOLDER = "PASTE_ZEPTOMAIL_SMTP_TOKEN_HERE";

const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;

// An unreplaced placeholder counts as "not configured" — otherwise every send
// fails with an opaque 535 auth error instead of the console fallback.
const hasSmtpConfig = !!(smtpUser && smtpPassword && smtpPassword !== PLACEHOLDER);

// ZeptoMail: host smtp.zeptomail.in (India DC) / smtp.zeptomail.com (US/EU),
// port 465 with SSL or 587 with STARTTLS, user is the literal "emailapikey",
// password is the agent's Send Mail token.
const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.zeptomail.in",
      port: parseInt(process.env.SMTP_PORT || "465", 10),
      // Port 465 is implicit TLS; 587 upgrades via STARTTLS.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
      auth: { user: smtpUser, pass: smtpPassword },
    })
  : null;

/**
 * The From address must be on a domain verified in ZeptoMail, or the provider
 * rejects the message. Falls back to the configured sender domain.
 */
function fromAddress() {
  return process.env.SMTP_FROM || "DailyOS <noreply@dailyos.dpdns.org>";
}

function wrap(title: string, body: string) {
  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f4f5;padding:32px 16px;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;border:1px solid #e4e4e7;">
      <div style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#71717a;">DailyOS</div>
      <h1 style="margin:12px 0 16px;font-size:20px;line-height:1.3;color:#18181b;">${title}</h1>
      ${body}
      <p style="margin-top:28px;font-size:12px;color:#a1a1aa;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </div>`;
}

/** Verifies the SMTP connection and credentials. Useful for a health check. */
export async function verifySmtp() {
  if (!transporter) {
    return { ok: false as const, error: "SMTP is not configured (SMTP_USER / SMTP_PASSWORD missing)." };
  }
  try {
    await transporter.verify();
    return { ok: true as const };
  } catch (error: unknown) {
    return { ok: false as const, error: error instanceof Error ? error.message : "SMTP verification failed." };
  }
}

export async function sendOtpEmail(to: string, otp: string) {
  if (!transporter) {
    console.warn(`[email] SMTP not configured — OTP code for ${to}: ${otp}`);
    return;
  }

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Your DailyOS verification code",
    text: `Your verification code is ${otp}. It expires in 15 minutes. If you didn't request this, ignore this email.`,
    html: wrap(
      "Your verification code",
      `<p style="margin:0 0 8px;font-size:14px;color:#3f3f46;">Enter this code to finish signing in:</p>
       <div style="font-size:30px;font-weight:700;letter-spacing:.28em;color:#18181b;padding:14px 0;">${otp}</div>
       <p style="margin:0;font-size:13px;color:#71717a;">It expires in 15 minutes.</p>`
    ),
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetLink = `${appUrl}/reset-password?token=${token}`;

  if (!transporter) {
    console.warn(`[email] SMTP not configured — reset link for ${to}: ${resetLink}`);
    return;
  }

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Reset your DailyOS password",
    text: `Reset your password here: ${resetLink}. This link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: wrap(
      "Reset your password",
      `<p style="margin:0 0 18px;font-size:14px;color:#3f3f46;">Click the button below to choose a new password.</p>
       <a href="${resetLink}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;">Reset password</a>
       <p style="margin:18px 0 0;font-size:12px;color:#71717a;word-break:break-all;">Or paste this link: ${resetLink}</p>
       <p style="margin:8px 0 0;font-size:13px;color:#71717a;">This link expires in 1 hour.</p>`
    ),
  });
}

/**
 * Sends a full copy of the account's data as a JSON attachment.
 *
 * `to` may be an address other than the account's own, at the user's request,
 * so the caller is expected to also notify the registered address — an export
 * quietly leaving for somewhere else is exactly what an attacker with a
 * borrowed session would want.
 */
export async function sendDataExportEmail(to: string, json: string, accountEmail: string) {
  const filename = `dailyos-export-${new Date().toISOString().slice(0, 10)}.json`;

  if (!transporter) {
    console.warn(`[email] SMTP not configured — data export for ${to} not sent (${json.length} bytes)`);
    return;
  }

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Your DailyOS data export",
    text: `Attached is a full copy of the data held for the DailyOS account ${accountEmail}, as JSON.`,
    html: wrap(
      "Your data export",
      `<p style="margin:0 0 8px;font-size:14px;color:#3f3f46;">Attached is a full copy of the data held for the account <strong>${accountEmail}</strong>, as JSON.</p>
       <p style="margin:0;font-size:13px;color:#71717a;">If you didn't ask for this, change your password — someone else may have access to your account.</p>`
    ),
    attachments: [{ filename, content: json, contentType: "application/json" }],
  });
}

/** Tells the registered address that an export was sent somewhere else. */
export async function sendExportSentElsewhereEmail(to: string, sentTo: string) {
  if (!transporter) {
    console.warn(`[email] SMTP not configured — export-notice for ${to} not sent`);
    return;
  }

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "A copy of your DailyOS data was sent to another address",
    text: `A full export of your DailyOS data was just sent to ${sentTo}. If that wasn't you, change your password immediately.`,
    html: wrap(
      "Your data was exported",
      `<p style="margin:0 0 8px;font-size:14px;color:#3f3f46;">A full export of your DailyOS data was just sent to <strong>${sentTo}</strong>.</p>
       <p style="margin:0;font-size:13px;color:#71717a;">If that wasn't you, change your password immediately — someone else has access to your account.</p>`
    ),
  });
}

/**
 * Warns that an account is going, and carries the data out with it.
 *
 * The export is attached rather than offered as a link: once the deadline
 * passes there is no account left to sign into and no link that could still
 * work, so the only moment this data can reliably reach its owner is now.
 */
export async function sendAccountDeletionScheduledEmail(
  to: string,
  deletesAt: Date,
  exportJson?: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const filename = `dailyos-export-${new Date().toISOString().slice(0, 10)}.json`;

  if (!transporter) {
    console.warn(`[email] SMTP not configured — deletion notice for ${to} not sent`);
    return;
  }

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Your DailyOS account is scheduled for deletion",
    text: `Your account and everything in it will be permanently deleted at ${deletesAt.toUTCString()}. A full copy of your data is attached. To stop this, sign in at ${appUrl} before then and choose "Keep my account".`,
    html: wrap(
      "Account scheduled for deletion",
      `<p style="margin:0 0 8px;font-size:14px;color:#3f3f46;">Your account and everything in it will be permanently deleted on <strong>${deletesAt.toUTCString()}</strong>.</p>
       ${
         exportJson
           ? `<p style="margin:0 0 8px;font-size:14px;color:#3f3f46;">A complete copy of your data is attached to this email. Keep it somewhere safe — once the account is gone we cannot send another.</p>`
           : ""
       }
       <p style="margin:0 0 8px;font-size:14px;color:#3f3f46;">Changed your mind? Sign in before then and choose &ldquo;Keep my account&rdquo;.</p>
       <p style="margin:0;font-size:13px;color:#71717a;"><a href="${appUrl}/login" style="color:#2563eb;">${appUrl}/login</a></p>`
    ),
    attachments: exportJson
      ? [{ filename, content: exportJson, contentType: "application/json" }]
      : undefined,
  });
}

export async function sendAccountDeletionCancelledEmail(to: string) {
  if (!transporter) return;

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Your DailyOS account will not be deleted",
    text: "The scheduled deletion of your DailyOS account has been cancelled. Nothing was removed.",
    html: wrap(
      "Deletion cancelled",
      `<p style="margin:0;font-size:14px;color:#3f3f46;">The scheduled deletion of your account has been cancelled. Nothing was removed.</p>`
    ),
  });
}

/** Sent once the address is verified and the account is actually usable. */
export async function sendWelcomeEmail(to: string, name: string | null) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const greeting = name?.trim() ? `Welcome, ${name.trim()}` : "Welcome to DailyOS";

  if (!transporter) {
    console.warn(`[email] SMTP not configured — welcome email for ${to} not sent`);
    return;
  }

  const row = (title: string, body: string) =>
    `<tr>
       <td style="padding:0 0 14px;">
         <div style="font-size:14px;font-weight:600;color:#18181b;">${title}</div>
         <div style="font-size:13px;color:#52525b;margin-top:2px;">${body}</div>
       </td>
     </tr>`;

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Welcome to DailyOS",
    text: [
      `${greeting}.`,
      "",
      "DailyOS keeps your notes, tasks, habits, goals, calendar and study log in one place.",
      "",
      "A few things worth knowing:",
      "- Notes have three modes: Write for rich text, Doodle for sketching, Canvas for dropping text anywhere.",
      "- Press Cmd/Ctrl + K anywhere to jump between pages.",
      "- Habits and goals feed the Analytics page, so the more you log the more it tells you.",
      "- Settings > Data can email you a full copy of everything you have, any time.",
      "",
      `Open your workspace: ${appUrl}/notes`,
    ].join("\n"),
    html: wrap(
      greeting,
      `<p style="margin:0 0 16px;font-size:14px;color:#3f3f46;">Your notes, tasks, habits, goals, calendar and study log now live in one place. A few things worth knowing before you start:</p>
       <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
         ${row("Notes have three modes", "Write for rich text, Doodle for sketching, and Canvas — double-click anywhere to drop a text block.")}
         ${row("Cmd/Ctrl + K goes anywhere", "The command palette jumps between pages without touching the sidebar.")}
         ${row("Logging feeds Analytics", "Habits, goals and study sessions all roll up there, so it gets more useful the more you use it.")}
         ${row("Your data stays yours", "Settings &rsaquo; Data emails you a full copy of everything, whenever you want it.")}
       </table>
       <p style="margin:20px 0 0;">
         <a href="${appUrl}/notes" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px;">Open DailyOS</a>
       </p>`
    ),
  });
}
