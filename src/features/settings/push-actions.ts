"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { sendPush } from "@/lib/push";

async function getUserIdOrThrow() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// What PushSubscription.toJSON() produces in the browser.
const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(10).max(500) }),
});

/** Turns push on for this browser. Re-subscribing just updates the keys. */
export async function savePushSubscriptionAction(subscription: unknown) {
  try {
    const userId = await getUserIdOrThrow();
    const sub = subscriptionSchema.parse(subscription);
    // A browser has one endpoint; if another account used it before on this
    // device, it now belongs to whoever is signed in.
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Couldn't turn on notifications") };
  }
}

export async function removePushSubscriptionAction(endpoint: string) {
  try {
    const userId = await getUserIdOrThrow();
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function sendTestPushAction() {
  try {
    const userId = await getUserIdOrThrow();
    const sent = await sendPush(userId, {
      title: "DailyOS notifications are on",
      body: "Your morning reminder will arrive here too.",
      url: "/today",
    });
    if (sent === 0) throw new Error("No device received it. Try turning notifications off and on again.");
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Couldn't send a test notification") };
  }
}
