import { sendDailyDigests } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends the morning digest (due, overdue, today's events) to everyone with
 * reminders on whose local time is between 08:00 and noon and who hasn't had
 * today's yet. Called hourly by .github/workflows/reminders.yml, so each
 * person gets theirs within an hour of 8am where they are, and once a day by
 * Vercel's cron (vercel.json) as a fallback.
 *
 * Accepts Vercel's `Bearer $CRON_SECRET`, or `Bearer $SCHEDULER_SECRET` for
 * the external scheduler. With neither set it refuses to run rather than
 * letting anyone trigger a mass email.
 */
export async function GET(request: Request) {
  const secrets = [process.env.CRON_SECRET, process.env.SCHEDULER_SECRET].filter(Boolean);
  if (secrets.length === 0) {
    console.error("[cron/reminders] CRON_SECRET is not set — refusing to run.");
    return Response.json({ error: "Not configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization");
  if (!secrets.some((s) => header === `Bearer ${s}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDailyDigests();
  console.log(`[cron/reminders] ${JSON.stringify(result)}`);
  return Response.json(result);
}
