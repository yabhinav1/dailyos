import { sendDailyDigests } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends the morning digest (due, overdue, today's events) to everyone with
 * reminders on. Scheduled once a day in vercel.json — the most Vercel Hobby
 * allows — at a time that is morning in India; each user's digest is still
 * built for their own calendar day.
 *
 * Same CRON_SECRET handling as /api/cron/purge-accounts: unset, it refuses
 * to run rather than letting anyone trigger a mass email.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/reminders] CRON_SECRET is not set — refusing to run.");
    return Response.json({ error: "Not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDailyDigests();
  console.log(`[cron/reminders] ${JSON.stringify(result)}`);
  return Response.json(result);
}
