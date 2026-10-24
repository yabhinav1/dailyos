"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js in production builds. Skipped in development, where
 * a worker caching /_next/static would fight hot reloading.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
