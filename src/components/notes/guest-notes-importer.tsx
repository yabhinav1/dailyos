"use client";

import React, { useEffect, useState } from "react";
import { importGuestNotes } from "@/features/notes/actions";
import { CheckCircle2, X } from "lucide-react";

const GUEST_NOTES_KEY = "dailyos_guest_notes";

/**
 * Runs once when a logged-in user lands in the dashboard. If this browser
 * has notes saved from before they had an account (guest mode on "/"),
 * it migrates them into the account and clears the local copy so they
 * don't get imported twice.
 */
export default function GuestNotesImporter() {
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(GUEST_NOTES_KEY);
    if (!raw) return;

    let guestNotes: any[] = [];
    try {
      guestNotes = JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(GUEST_NOTES_KEY);
      return;
    }

    if (!Array.isArray(guestNotes) || guestNotes.length === 0) {
      window.localStorage.removeItem(GUEST_NOTES_KEY);
      return;
    }

    // Clear immediately so a refresh mid-import can't double-import.
    window.localStorage.removeItem(GUEST_NOTES_KEY);

    importGuestNotes(
      guestNotes.map((n) => ({
        title: n.title,
        content: n.content,
        doodleData: n.doodleData,
      }))
    ).then((res) => {
      if (res.success && res.imported > 0) {
        setBanner(
          `Imported ${res.imported} note${res.imported === 1 ? "" : "s"} from this device.`
        );
        setTimeout(() => setBanner(null), 6000);
      }
    });
  }, []);

  if (!banner) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 shadow-lg">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      <span>{banner}</span>
      <button onClick={() => setBanner(null)} className="text-emerald-500/70 hover:text-emerald-300">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
