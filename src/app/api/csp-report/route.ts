export const runtime = "nodejs";

// A page that breaks the policy can report the same violation on every
// render; log each distinct one at most once a minute per instance.
const recent = new Map<string, number>();
const DEDUPE_MS = 60_000;

type Report = Record<string, unknown>;

/** Both formats browsers use: report-uri sends one, Reporting API sends a list. */
function normalise(body: unknown): Report[] {
  if (Array.isArray(body)) return body.map((r) => (r as { body?: Report }).body ?? {}).filter(Boolean);
  const legacy = (body as { "csp-report"?: Report } | null)?.["csp-report"];
  return legacy ? [legacy] : [];
}

const pick = (r: Report, ...keys: string[]) => {
  for (const k of keys) if (typeof r[k] === "string" && r[k]) return (r[k] as string).slice(0, 300);
  return undefined;
};

/**
 * Receives Content-Security-Policy violation reports (the policy is
 * report-only for now, see next.config.ts) and logs each as one JSON line,
 * so the Vercel logs show whether enforcing it would break anything.
 * Query strings are dropped from URLs: they can carry tokens.
 */
export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 64 * 1024) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  const strip = (u?: string) => u?.split(/[?#]/)[0];
  for (const r of normalise(body).slice(0, 20)) {
    const entry = {
      level: "warn",
      kind: "csp-violation",
      directive: pick(r, "effectiveDirective", "effective-directive", "violated-directive"),
      blocked: strip(pick(r, "blockedURL", "blocked-uri")),
      page: strip(pick(r, "documentURL", "document-uri")),
      source: strip(pick(r, "sourceFile", "source-file")),
    };
    const key = `${entry.directive}|${entry.blocked}|${entry.page}`;
    const now = Date.now();
    if ((recent.get(key) ?? 0) > now - DEDUPE_MS) continue;
    recent.set(key, now);
    console.warn(JSON.stringify(entry));
  }
  return new Response(null, { status: 204 });
}
