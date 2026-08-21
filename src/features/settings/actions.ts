"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateAvatarUrl, randomAvatarSeed } from "@/lib/avatar";
import { sendOtpEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getErrorMessage } from "@/lib/utils";
import { generateOtp, otpMatches, MAX_OTP_ATTEMPTS } from "@/lib/otp";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// -------------------------------------------------------------
// PROFILE + PREFERENCES
// -------------------------------------------------------------

export async function getUserSettings() {
  try {
    const userId = await getUserId();
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        username: true,
        image: true,
        pendingEmail: true,
        password: true,
        deletionScheduledAt: true,
      },
    });
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { provider: true, providerAccountId: true },
    });
    return {
      success: true,
      data: {
        settings,
        user: user ? { ...user, hasPassword: !!user.password, password: undefined } : null,
        accounts,
      },
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/** Rerolls the user's avatar to a new random robot avatar. */
export async function regenerateAvatar() {
  const userId = await getUserId();
  const image = generateAvatarUrl(randomAvatarSeed());
  await prisma.user.update({ where: { id: userId }, data: { image } });
  revalidatePath("/settings");
  return { success: true, image };
}

/** Sets a fully custom avatar (uploaded photo, stored as a data URL). */
export async function uploadCustomAvatar(dataUrl: string) {
  try {
    const userId = await getUserId();

    if (!dataUrl.startsWith("data:image/")) {
      return { success: false, message: "Invalid image format." };
    }
    // Rough size guard: base64 data URLs are ~4/3 the byte size. Cap around ~2MB source image.
    const approxBytes = dataUrl.length * 0.75;
    if (approxBytes > 2 * 1024 * 1024) {
      return { success: false, message: "Image is too large. Please use an image under 2MB." };
    }

    await prisma.user.update({ where: { id: userId }, data: { image: dataUrl } });
    revalidatePath("/settings");
    return { success: true, image: dataUrl };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to upload avatar.") };
  }
}

export async function updateUserSettings(theme: string, remindersEnabled: boolean) {
  const userId = await getUserId();
  await prisma.userSettings.upsert({
    where: { userId },
    update: { theme, remindersEnabled },
    create: { userId, theme, remindersEnabled },
  });
  revalidatePath("/settings");
  return { success: true };
}

export async function updateProfile(name: string, username: string) {
  const userId = await getUserId();
  // Check username uniqueness if modified
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.username !== username) {
    const exists = await prisma.user.findFirst({ where: { username } });
    if (exists) throw new Error("Username already taken.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { name, username },
  });
  revalidatePath("/settings");
  return { success: true };
}

// -------------------------------------------------------------
// EMAIL CHANGE (OTP verified)
// -------------------------------------------------------------

/** Step 1: request a change of email — sends a 6-digit code to the NEW address. */
export async function requestEmailChange(newEmail: string) {
  try {
    const userId = await getUserId();

    const normalized = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return { success: false, message: "Please enter a valid email address." };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email.toLowerCase() === normalized) {
      return { success: false, message: "That's already your current email." };
    }

    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing) {
      return { success: false, message: "That email is already in use by another account." };
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: { pendingEmail: normalized, otp, otpExpires, otpAttempts: 0 },
    });

    await sendOtpEmail(normalized, otp);

    return { success: true, message: `Verification code sent to ${normalized}.` };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to start email change.") };
  }
}

/** Step 2: confirm the code sent to the new address, finalizing the email change. */
export async function verifyEmailChange(otpCode: string) {
  try {
    const userId = await getUserId();
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user?.pendingEmail || !user.otp || !user.otpExpires) {
      return { success: false, message: "No pending email change found. Please start again." };
    }
    if (user.otpExpires < new Date()) {
      return { success: false, message: "Code expired. Please request a new one." };
    }
    // Burn the code once it has absorbed a handful of wrong guesses, so the
    // six-digit space cannot be walked inside the expiry window.
    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      await prisma.user.update({
        where: { id: userId },
        data: { otp: null, otpExpires: null, otpAttempts: 0 },
      });
      return { success: false, message: "Too many incorrect attempts. Request a new code." };
    }
    if (!otpMatches(user.otp, otpCode)) {
      await prisma.user.update({
        where: { id: userId },
        data: { otpAttempts: { increment: 1 } },
      });
      return { success: false, message: "Incorrect verification code." };
    }

    const newEmail = user.pendingEmail;

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        pendingEmail: null,
        otp: null,
        otpExpires: null,
        otpAttempts: 0,
        emailVerified: new Date(),
      },
    });

    await createNotification(
      userId,
      "Email address updated",
      `Your account email was changed to ${newEmail}.`,
      "SUCCESS"
    );

    revalidatePath("/settings");
    return { success: true, message: "Email updated successfully!", email: newEmail };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to verify code.") };
  }
}

/** Cancels a pending email-change request. */
export async function cancelEmailChange() {
  try {
    const userId = await getUserId();
    await prisma.user.update({
      where: { id: userId },
      data: { pendingEmail: null, otp: null, otpExpires: null },
    });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function resendEmailChangeOtp() {
  try {
    const userId = await getUserId();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.pendingEmail) {
      return { success: false, message: "No pending email change to resend a code for." };
    }
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.user.update({ where: { id: userId }, data: { otp, otpExpires, otpAttempts: 0 } });
    await sendOtpEmail(user.pendingEmail, otp);
    return { success: true, message: "Code resent." };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to resend code.") };
  }
}

// -------------------------------------------------------------
// PASSWORD
// -------------------------------------------------------------

export async function changePassword(currentPassword: string, newPassword: string) {
  try {
    const userId = await getUserId();

    if (!newPassword || newPassword.length < 8) {
      return { success: false, message: "New password must be at least 8 characters." };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: "User not found." };

    // If the account already has a password, the current one must be verified.
    if (user.password) {
      if (!currentPassword) {
        return { success: false, message: "Please enter your current password." };
      }
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return { success: false, message: "Current password is incorrect." };
      }
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    await createNotification(
      userId,
      user.password ? "Password changed" : "Password created",
      user.password
        ? "Your account password was just updated."
        : "You've set a password, so you can now sign in with email + password too.",
      "SUCCESS"
    );

    return {
      success: true,
      message: user.password ? "Password updated successfully!" : "Password set successfully!",
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to change password.") };
  }
}

// -------------------------------------------------------------
// LINKED ACCOUNTS
// -------------------------------------------------------------

export async function unlinkAccount(provider: string) {
  try {
    const userId = await getUserId();

    const [accounts, user] = await Promise.all([
      prisma.account.findMany({ where: { userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { password: true } }),
    ]);

    const remainingAfterUnlink = accounts.filter((a: { provider: string }) => a.provider !== provider);

    // Guard: don't let the user lock themselves out — they need either a
    // password or at least one other linked provider remaining.
    if (remainingAfterUnlink.length === 0 && !user?.password) {
      return {
        success: false,
        message: "Set a password first, or keep at least one linked account, so you don't get locked out.",
      };
    }

    await prisma.account.deleteMany({ where: { userId, provider } });
    revalidatePath("/settings");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Failed to unlink account.") };
  }
}
