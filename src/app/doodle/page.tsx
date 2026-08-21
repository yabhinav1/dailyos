"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";

const DoodleCanvas = dynamic(() => import("@/components/doodle/doodle-canvas"), {
  ssr: false,
});

const DRAFT_KEY = "dailyos_doodle_draft";

export default function DoodlePage() {
  const [draft, setDraft] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // localStorage is unreadable during SSR, so the draft cannot come from a lazy
  // useState initializer without a hydration mismatch. `loaded` keeps the canvas
  // unmounted until the saved drawing is in hand, so it never starts blank.
  useEffect(() => {
    const saved = window.localStorage.getItem(DRAFT_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setDraft(saved);
    setLoaded(true);
  }, []);

  const handleChange = (dataUrl: string) => {
    window.localStorage.setItem(DRAFT_KEY, dataUrl);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0d0d0d] text-zinc-200">
      <div className="flex shrink-0 items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-sm font-bold text-white">Doodle</h1>
          <p className="text-xs text-zinc-400">
            Sketch freely. Saved to this browser automatically.
          </p>
        </div>
      </div>

      {/* The whole rest of the screen is the whiteboard. */}
      <div className="flex-1 min-h-0 px-4 pb-4">
        {loaded && (
          <DoodleCanvas
            value={draft}
            onChange={handleChange}
            fillContainer
            defaultToolbarPosition="top"
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}
