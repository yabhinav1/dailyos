import path from "node:path";
import type { NextConfig } from "next";

// Baseline hardening for every response. No CSP yet: Tiptap, the doodle
// canvas and Spotify artwork need a policy worked out and tested on its own.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing embeds the app, so refuse framing outright (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Microphone stays allowed for our own origin: voice notes in the rich editor.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
  },
};

export default nextConfig;
