import { auth } from "@/lib/auth";

// Needs to fetch an external service and relay a live stream — Node runtime.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resolverUrl = process.env.RESOLVER_URL;
  const apiKey = process.env.RESOLVER_API_KEY;
  if (!resolverUrl || !apiKey) {
    return new Response(
      "Search playback isn't configured yet — RESOLVER_URL / RESOLVER_API_KEY are missing.",
      { status: 501 }
    );
  }

  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  const artist = searchParams.get("artist") || "";
  if (!title) {
    return new Response("title is required", { status: 400 });
  }

  const upstreamUrl = `${resolverUrl.replace(/\/$/, "")}/stream?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
  const range = req.headers.get("range");

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "x-api-key": apiKey,
        ...(range ? { Range: range } : {}),
      },
      // Don't let Next.js cache/dedupe a live audio stream.
      cache: "no-store",
    });

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text().catch(() => "");
      return new Response(text || `Resolver returned ${upstream.status}`, { status: 502 });
    }

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    if (contentType) headers.set("Content-Type", contentType);
    if (contentLength) headers.set("Content-Length", contentLength);
    if (contentRange) headers.set("Content-Range", contentRange);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err: any) {
    return new Response(err?.message || "Failed to reach resolver.", { status: 502 });
  }
}
