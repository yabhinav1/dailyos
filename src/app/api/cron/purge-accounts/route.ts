import { prisma } from "@/lib/prisma";
import { purgeAccount } from "@/lib/account-purge";

// GridFS needs Node APIs, and this must never be prerendered or cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deletes accounts whose grace period has run out.
 *
 * Purging also happens on first access after the deadline, which covers anyone
 * who comes back. This covers everyone who doesn't: without it, an account
 * nobody returns to would sit past its deadline indefinitely.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when that variable is set
 * on the project. Without the variable this route refuses everything rather
 * than running unauthenticated — an open endpoint that deletes accounts is
 * worse than a cron that silently does nothing, and the failure is visible in
 * the cron log either way.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/purge-accounts] CRON_SECRET is not set — refusing to run.");
    return Response.json({ error: "Not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await prisma.user.findMany({
    where: { deletionScheduledAt: { not: null, lte: new Date() } },
    select: { id: true, email: true },
  });

  let purged = 0;
  let files = 0;
  for (const user of due) {
    try {
      const result = await purgeAccount(user.id);
      files += result.filesDeleted;
      purged += 1;
    } catch (err) {
      // One bad account must not stop the rest of the run.
      console.error(`[cron/purge-accounts] failed to purge ${user.id}:`, err);
    }
  }

  console.log(`[cron/purge-accounts] due=${due.length} purged=${purged} files=${files}`);
  return Response.json({ due: due.length, purged, filesDeleted: files });
}
