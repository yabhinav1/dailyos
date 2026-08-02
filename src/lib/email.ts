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
