import type { Instrumentation } from "next";

// Same message from the same route within this window is reported once per
// server instance, so a crash loop can't flood the webhook.
const DEDUPE_MS = 60_000;
const recent = new Map<string, number>();

/**
 * Every uncaught server error (render, route handler, Server Action, proxy)
 * as one JSON line in the Vercel logs, searchable by route. Set
 * ERROR_WEBHOOK_URL to a Discord or Slack incoming webhook to be pinged too.
 *
 * Deliberately left out: request headers (cookies, auth) and query strings,
 * which can carry tokens such as share links or reset codes.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = (error as { digest?: string } | null)?.digest;
  const path = request.path.split("?")[0];

  const entry = {
    level: "error",
    at: new Date().toISOString(),
    route: context.routePath,
    type: context.routeType,
    method: request.method,
    path,
    message: err.message,
    digest,
    stack: err.stack?.split("\n").slice(0, 8).join("\n"),
  };
  console.error(JSON.stringify(entry));

  const webhook = process.env.ERROR_WEBHOOK_URL;
  if (!webhook) return;

  const key = `${context.routePath}|${err.message}`;
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - DEDUPE_MS) return;
  recent.set(key, now);

  const text = `🔴 DailyOS ${context.routeType} error on ${request.method} ${path}\n${err.message}${digest ? `\ndigest: ${digest}` : ""}`;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Discord reads `content`, Slack reads `text`; each ignores the other.
      body: JSON.stringify({ content: text.slice(0, 1900), text }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Reporting must never become a second failure.
  }
};
