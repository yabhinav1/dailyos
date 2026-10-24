"use client";

import { useEffect } from "react";
import { updateTimezone } from "@/features/settings/actions";

/**
 * Saves the browser's time zone when it differs from the stored one — on
 * first sign-in, and again after travelling. Renders nothing.
 */
export default function TimezoneSync({ saved }: { saved: string | null }) {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && zone !== saved) {
      updateTimezone(zone).catch(() => {
        // Not worth bothering the user over; the next page load retries.
      });
    }
  }, [saved]);

  return null;
}
