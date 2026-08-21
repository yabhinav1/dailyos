import { randomInt, timingSafeEqual } from "node:crypto";

/**
 * One-time codes for email verification and email changes.
 *
 * These were generated with Math.random(), which is not a cryptographic RNG:
 * V8's generator state can be recovered from a handful of observed outputs, so
 * anyone able to request codes to an address they control could predict the
 * next code issued to someone else.
 */

/** How many wrong guesses a single code tolerates before it is burned. */
export const MAX_OTP_ATTEMPTS = 5;

/** Six digits, uniformly distributed, from the OS entropy source. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Compares in constant time. The window here is narrow enough that a timing
 * attack is impractical over a network, but a short-circuiting `===` on a
 * secret is the kind of thing that stops being harmless when the code moves.
 */
export function otpMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  // timingSafeEqual throws unless both buffers are the same length, and the
  // length of a 6-digit code is not a secret.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Account lockout after repeated wrong passwords. */
export const MAX_FAILED_LOGINS = 8;
export const LOCKOUT_MINUTES = 15;

export function lockoutExpiry(): Date {
  return new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
}
