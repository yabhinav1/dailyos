import nodemailer from "nodemailer";

const hasSmtpConfig = !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  : null;

export async function sendOtpEmail(to: string, otp: string) {
  const from = process.env.SMTP_FROM || `"DailyOS" <${process.env.SMTP_USER || "noreply@dailyos.app"}>`;

  if (!transporter) {
    console.warn(`OTP Code for ${to}: ${otp}`);
    return;
  }

  await transporter.sendMail({
    from,
    to,
    subject: "Your DailyOS verification code",
    text: `Your verification code is ${otp}. It expires in 15 minutes. If you didn't request this, ignore this email.`,
    html: `<p>Your verification code is: <strong>${otp}</strong></p><p>It expires in 15 minutes. If you didn't request this, ignore this email.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const from = process.env.SMTP_FROM || `"DailyOS" <${process.env.SMTP_USER || "noreply@dailyos.app"}>`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetLink = `${appUrl}/reset-password?token=${token}`;

  if (!transporter) {
    console.warn(`Reset link for ${to}: ${resetLink}`);
    return;
  }

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your DailyOS password",
    text: `Reset your password here: ${resetLink}. This link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: `<p>Reset your password here: <a href="${resetLink}">${resetLink}</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
  });
}
