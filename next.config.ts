import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Report-only for now: nothing is blocked, and browsers post any violation
// to /api/csp-report, which logs it as a JSON line with kind "csp-violation".
// Once the Vercel logs show none for a week of real use, rename the header to
// Content-Security-Policy to enforce it.
//
// - script/style 'unsafe-inline': Next's inline bootstrap scripts (no nonce
//   setup) and Tiptap/framer-motion inline styles.
// - img/media https:: notes embed images from anywhere; Spotify artwork,
//   Google/GitHub avatars and dicebear avatars come from several hosts.
// - connect-src https:: the developer API tester calls arbitrary URLs.
// - form-action: Chrome applies it to the redirect after the sign-in form
//   posts, so the OAuth providers must be listed.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https:${isDev ? " ws: http://localhost:*" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com https://github.com",
  // report-uri rather than report-to: Firefox only supports this one, and
  // Chrome ignores it when report-to is present but then batches and delays
  // report-to deliveries.
  "report-uri /api/csp-report",
].join("; ");

// Baseline hardening for every response.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing embeds the app, so refuse framing outright (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Microphone stays allowed for our own origin: voice notes in the rich editor.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The service worker must never be served from a cache, or users get
        // stuck on an old version (Next PWA guide).
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  turbopack: {
    // A stray package-lock.json in the user's home directory made Next infer
    // C:\Users\yadav as the workspace root. Pin it to this project instead.
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      // Default is 1MB; raised so file uploads (e.g. PDFs going to
      // MongoDB storage via uploadProjectFile) aren't rejected.
      // Verified against node_modules/next/dist/docs for 16.2.10: this key
      // still lives under `experimental.serverActions`.
      bodySizeLimit: "50mb",
    },
    // A navigation or Server Action made while the connection is down waits
    // and retries when it returns, instead of throwing. Also powers the
    // useOffline() banner. See docs/01-app/02-guides/offline-support.md.
    useOffline: true,
  },
};

export default nextConfig;
