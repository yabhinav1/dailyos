"use client";

import { useOffline } from "next/offline";
import { WifiOff } from "lucide-react";

/**
 * Shown while the connection is down. With experimental.useOffline on,
 * navigations and saves made meanwhile wait and go through on reconnect,
 * so the message can promise that rather than an error.
 */
export default function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="fixed top-3 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-950/90 px-4 py-1.5 text-xs font-medium text-amber-200 shadow-lg backdrop-blur"
    >
      <WifiOff className="h-3.5 w-3.5" />
      You&apos;re offline. Changes will save when you reconnect.
    </div>
  );
}
