import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
