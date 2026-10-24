import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured: boolean | null = null;

/** VAPID keys identify this server to browsers' push services. */
function configure() {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:noreply@dailyos.dpdns.org", publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured() {
  return configure();
}

/**
 * Sends a notification to every browser the user turned push on in. Stale
 * subscriptions (the browser forgot us, or the user revoked permission) are
 * removed. Does nothing when VAPID keys aren't set.
 */
export async function sendPush(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!configure()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 12 * 60 * 60 }
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`[push] send failed (${status ?? "?"}):`, err);
        }
      }
    })
  );
  return sent;
}
