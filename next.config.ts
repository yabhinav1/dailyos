import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB; raised so file uploads (e.g. PDFs going to
      // MongoDB storage via uploadProjectFile) aren't rejected.
      // NOTE: check this key against the docs for the Next.js version
      // actually installed here — the option's location has moved between
      // Next major versions and this project pins an unusually new one.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
