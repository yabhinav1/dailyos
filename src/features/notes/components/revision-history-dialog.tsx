"use client";

import React, { useEffect, useState } from "react";
import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNoteRevisionsAction } from "@/features/notes/actions";

type Revision = Awaited<ReturnType<typeof getNoteRevisionsAction>>["data"][number];

/**
 * Earlier versions of a note, newest first. A version is kept when an edit
 * starts after ten quiet minutes (see src/lib/note-revisions.ts), so the list
 * reads as one entry per editing session, with who made it.
 */
export default function RevisionHistoryDialog({
  open,
  noteId,
  onClose,
  onRestore,
}: {
  open: boolean;
  noteId: string;
  onClose: () => void;
  /** Puts that version back; the dialog waits for it. */
  onRestore: (revisionId: string) => Promise<void>;
}) {
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Reload whenever it opens, dropping the last note's list straight away.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const key = open ? noteId : null;
  if (key !== loadedFor) {
    setLoadedFor(key);
    setRevisions(null);
  }

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    getNoteRevisionsAction(key).then((res) => {
      if (!cancelled) setRevisions(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!open) return null;

  const restore = async (id: string) => {
    setRestoring(id);
    try {
      await onRestore(id);
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div role="dialog" aria-label="Revision history" className="bg-[#171717] border border-zinc-800 rounded-xl p-5 max-w-md w-full space-y-3 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-300" /> Version history
          </h3>
          <button onClick={onClose} aria-label="Close" className="text-zinc-300 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {revisions === null ? (
            <p className="text-xs text-zinc-400 py-4 text-center">Loading…</p>
          ) : revisions.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">
              No earlier versions yet. One is kept each time you come back to edit after a break of ten minutes or more.
            </p>
          ) : (
            revisions.map((r) => (
              <div key={r.id} className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-200 truncate">{r.title || "Untitled Note"}</div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {new Date(r.savedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {r.editedBy && ` · ${r.editedBy}`}
                  </div>
                </div>
                <Button size="xs" disabled={restoring !== null} onClick={() => restore(r.id)} className="text-[11px] h-6 px-2 shrink-0">
                  {restoring === r.id ? "…" : "Restore"}
                </Button>
              </div>
            ))
          )}
        </div>
        <p className="text-[11px] text-zinc-500">Restoring keeps the current version in this list too, so it can be undone.</p>
      </div>
    </div>
  );
}
