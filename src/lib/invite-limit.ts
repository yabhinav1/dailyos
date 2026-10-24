import { prisma } from "@/lib/prisma";

/**
 * Every invite emails an address the inviter typed, from our domain. Without
 * a cap, an account could make throwaway notes and use DailyOS to mail
 * strangers, which is how a sending domain gets suspended.
 */
export const DAILY_INVITE_LIMIT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Throws once the user has sent DAILY_INVITE_LIMIT invites in 24 hours. */
export async function assertInviteBudget(userId: string) {
  const since = new Date(Date.now() - DAY_MS);
  const [notes, projects] = await Promise.all([
    prisma.noteShare.count({ where: { createdAt: { gte: since }, note: { userId } } }),
    prisma.projectShare.count({ where: { createdAt: { gte: since }, project: { userId } } }),
  ]);
  if (notes + projects >= DAILY_INVITE_LIMIT) {
    throw new Error(`You've sent ${DAILY_INVITE_LIMIT} invites in the last day. Try again tomorrow, or share the link instead.`);
  }
}
