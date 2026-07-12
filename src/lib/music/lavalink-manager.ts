import "server-only";
import { prisma } from "@/lib/prisma";

export interface LavalinkNodeConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  password: string;
  secure: boolean;
  priority: number;
}

interface LavalinkCheckResult {
  ok: boolean;
  status: "ONLINE" | "OFFLINE" | "ERROR";
  error?: string;
}

function nodeBaseUrl(node: LavalinkNodeConfig, path: string) {
  const scheme = node.secure ? "https" : "http";
  return `${scheme}://${node.host}:${node.port}${path}`;
}

/**
 * Pings a single Lavalink node's /v4/info endpoint to verify it's alive
 * and the configured password is accepted. Distinguishes auth failures
 * (403 — wrong password) from network failures (ECONNREFUSED/timeout)
 * so the admin UI can show a precise reason instead of a generic "down".
 */
export async function checkLavalinkNode(node: LavalinkNodeConfig): Promise<LavalinkCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(nodeBaseUrl(node, "/v4/info"), {
      headers: { Authorization: node.password },
      signal: controller.signal,
    });

    if (res.status === 403 || res.status === 401) {
      return { ok: false, status: "ERROR", error: `${res.status} ${res.status === 403 ? "Forbidden" : "Unauthorized"} — check node password` };
    }
    if (!res.ok) {
      return { ok: false, status: "ERROR", error: `HTTP ${res.status}` };
    }
    return { ok: true, status: "ONLINE" };
  } catch (err: any) {
    const message =
      err?.name === "AbortError"
        ? "Timed out after 5s"
        : err?.code === "ECONNREFUSED"
        ? "ECONNREFUSED — node not reachable on that host/port"
        : err?.message || "Unknown network error";
    return { ok: false, status: "OFFLINE", error: message };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Runs a health check against every enabled node and persists the result.
 * Call this periodically (e.g. from a cron/interval) or on-demand before
 * picking a node to use.
 */
export async function refreshNodeHealth() {
  const nodes = await prisma.lavalinkNode.findMany({ where: { enabled: true } });

  await Promise.all(
    nodes.map(async (n: LavalinkNodeConfig) => {
      const result = await checkLavalinkNode(n);
      await prisma.lavalinkNode.update({
        where: { id: n.id },
        data: {
          status: result.status,
          lastError: result.error ?? null,
          lastCheckedAt: new Date(),
        },
      });
    })
  );
}

/**
 * Returns the best available Lavalink node, trying nodes in priority order
 * and automatically skipping ones that fail a live check. This is the
 * failover entry point every playback request should go through instead
 * of hardcoding a single node.
 */
export async function getActiveLavalinkNode(): Promise<LavalinkNodeConfig | null> {
  const nodes = await prisma.lavalinkNode.findMany({
    where: { enabled: true },
    orderBy: { priority: "asc" },
  });

  for (const n of nodes) {
    const result = await checkLavalinkNode(n);

    // Persist the latest status as we go so the admin UI stays fresh
    // without needing a separate polling job.
    await prisma.lavalinkNode.update({
      where: { id: n.id },
      data: { status: result.status, lastError: result.error ?? null, lastCheckedAt: new Date() },
    }).catch(() => {}); // best-effort; don't let a status write block failover

    if (result.ok) {
      return {
        id: n.id,
        name: n.name,
        host: n.host,
        port: n.port,
        password: n.password,
        secure: n.secure,
        priority: n.priority,
      };
    }
  }

  return null; // every node is down — caller should fall back to local uploads
}

/**
 * Searches for tracks via the active Lavalink node (falls over to the next
 * node automatically if the first one that responds to /v4/info fails
 * mid-search).
 */
export async function lavalinkSearch(query: string) {
  const node = await getActiveLavalinkNode();
  if (!node) {
    throw new Error("No Lavalink nodes are currently reachable");
  }

  const res = await fetch(
    nodeBaseUrl(node, `/v4/loadtracks?identifier=${encodeURIComponent(`ytsearch:${query}`)}`),
    { headers: { Authorization: node.password } }
  );

  if (!res.ok) {
    throw new Error(`Lavalink search failed: HTTP ${res.status}`);
  }

  return res.json();
}
