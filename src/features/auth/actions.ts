"use server";

import { prisma } from "@/lib/prisma";
import { sendOtpEmail, sendPasswordResetEmail } from "@/lib/email";
import { generateAvatarUrl } from "@/lib/avatar";
import { createNotification } from "@/lib/notifications";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain alphanumeric characters and underscores"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type RegisterState = {
  success: boolean;
  message: string;
  email?: string;
  errors?: {
    name?: string[];
    username?: string[];
    email?: string[];
    password?: string[];
  };
};

// Generates a random 6-digit numeric OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function registerUser(
  prevState: RegisterState | null,
  formData: FormData
): Promise<RegisterState> {
  const name = formData.get("name") as string;
  const username = formData.get("username") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const validatedFields = registerSchema.safeParse({
    name,
    username,
    email,
    password,
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: "Validation failed",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    // Check if email or username is already taken
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return {
        success: false,
        message: "A user with this email already exists.",
        errors: {
          email: ["Email already in use"],
        },
      };
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return {
        success: false,
        message: "This username is already taken.",
        errors: {
          username: ["Username already in use"],
        },
      };
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create user and initialize settings
    const createdUser = await prisma.user.create({
      data: {
        name,
        username,
        email,
        password: hashedPassword,
        image: generateAvatarUrl(username),
        otp,
        otpExpires,
        settings: {
          create: {
            theme: "dark",
            widgetConfig: {},
          },
        },
      },
    });

    // Send the OTP verification email
    await sendOtpEmail(email, otp);

    await createNotification(
      createdUser.id,
      `Welcome to DailyOS, ${name}!`,
      "Your account is ready. Verify your email to unlock reminders and everything else.",
      "SUCCESS"
    );

    return {
      success: true,
      message: "Registration successful! Verification code sent to your email.",
      email,
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      message: "Something went wrong during registration. Please try again.",
    };
  }
}

// Server Action to verify OTP code
export async function verifyOtp(email: string, otpCode: string): Promise<{ success: boolean; message: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { success: false, message: "User not found." };
    }

    if (!user.otp || !user.otpExpires) {
      return { success: false, message: "No verification code exists for this user." };
    }

    if (user.otpExpires < new Date()) {
      return { success: false, message: "Verification code has expired. Please request a new one." };
    }

    if (user.otp !== otpCode) {
      return { success: false, message: "Incorrect verification code." };
    }

    // Verify user, clear OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        otp: null,
        otpExpires: null,
      },
    });

    return { success: true, message: "Email verified successfully!" };
  } catch (error) {
    console.error("Verify OTP error:", error);
    return { success: false, message: "Internal server error. Please try again." };
  }
}

// Server Action to resend OTP
export async function resendOtp(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { success: false, message: "User not found." };
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otp,
        otpExpires,
      },
    });

    await sendOtpEmail(email, otp);

    return { success: true, message: "Verification code resent successfully!" };
  } catch (error) {
    console.error("Resend OTP error:", error);
    return { success: false, message: "Internal server error. Please try again." };
  }
}

// Server Action to request password reset
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // For security reasons, do not reveal if the email is registered or not.
    // Simply say "If that email is registered, we have sent a reset link."
    if (!user) {
      return { success: true, message: "If that email is registered, a password reset link has been sent." };
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires,
      },
    });

    await sendPasswordResetEmail(email, resetToken);

    return { success: true, message: "If that email is registered, a password reset link has been sent." };
  } catch (error) {
    console.error("Request password reset error:", error);
    return { success: false, message: "Internal server error. Please try again." };
  }
}

// Server Action to reset password
export async function resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }> {
  if (!password || password.length < 6) {
    return { success: false, message: "Password must be at least 6 characters long." };
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return { success: false, message: "Invalid or expired password reset link." };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return { success: true, message: "Password has been reset successfully! You can now log in." };
  } catch (error) {
    console.error("Reset password error:", error);
    return { success: false, message: "Internal server error. Please try again." };
  }
}
