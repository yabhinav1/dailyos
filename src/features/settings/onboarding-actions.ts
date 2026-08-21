"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";

/**
 * Marks the welcome walkthrough as seen.
 *
 * Upserts rather than updates: accounts created before UserSettings existed —
 * and any created by the OAuth adapter, which does not run the signup path —
 * have no settings row, and those are exactly the accounts that will be
 * seeing this for the first time.
 */
export async function completeOnboarding() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        theme: "dark",
        widgetConfig: {},
        onboardedAt: new Date(),
      },
      update: { onboardedAt: new Date() },
    });

    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Couldn't save that.") };
  }
}
