"use client";

import React from "react";
import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type NoteSnapshot = {
  id: string;
  time: string;
  title: string;
  content: string;
  doodle: string | null;
};

/**
 * Earlier versions of the open note from this session, newest first.
 * Snapshots are taken as saves land (see the notes page), so this is an undo
 * history for the current visit rather than a permanent archive.
 */
export default function RevisionHistoryDialog({
  open,
  snapshots,
  onClose,
  onRestore,
}: {
  open: boolean;
  snapshots: NoteSnapshot[];
  onClose: () => void;
  onRestore: (snapshot: NoteSnapshot) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div role="dialog" aria-label="Revision history" className="bg-[#171717] border border-zinc-800 rounded-xl p-5 max-w-md w-full space-y-3 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-300" /> Revision History
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-zinc-300 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {snapshots.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">
              No earlier versions yet. A snapshot is kept each time your edits save, for as long as this note stays open.
            </p>
          ) : (
            snapshots.map((snap) => (
              <div key={snap.id} className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-200 truncate">{snap.title || "Untitled Note"}</div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {snap.time} · {snap.content.replace(/<[^>]+>/g, " ").trim().slice(0, 50) || "Empty"}
                  </div>
                </div>
                <Button size="xs" onClick={() => onRestore(snap)} className="text-[11px] h-6 px-2 shrink-0">
                  Restore
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
