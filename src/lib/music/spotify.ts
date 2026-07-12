// Spotify search via the Client Credentials flow — app-only auth, no user
// login, no Dev Mode allowlist involved. Only used for search metadata
// (title/artist/album art/duration); Spotify never gives out playable audio
// via this flow, that's handled by the separate resolver service.

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set.");
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    // Refresh a minute early to be safe.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export interface SpotifySearchResult {
  spotifyId: string;
  title: string;
  artist: string;
  albumArt: string | null;
  durationMs: number;
}

export async function searchSpotify(query: string, limit = 10): Promise<SpotifySearchResult[]> {
  if (!query.trim()) return [];

  const token = await getAccessToken();
  // Spotify's Feb 2026 Dev Mode changes capped this at 10 (was 50) — clamp
  // defensively so a bad caller-supplied value doesn't 400 the request.
  const clampedLimit = Math.min(Math.max(limit, 1), 10);
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${clampedLimit}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify search failed: ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }

  const data = await res.json();
  const items = data?.tracks?.items || [];

  return items.map((t: {
    id: string;
    name: string;
    artists: { name: string }[];
    album?: { images?: { url: string }[] };
    duration_ms: number;
  }) => ({
    spotifyId: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    albumArt: t.album?.images?.[0]?.url || null,
    durationMs: t.duration_ms,
  }));
}
