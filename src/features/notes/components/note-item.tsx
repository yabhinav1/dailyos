"use client";

import React from "react";
import { motion } from "framer-motion";
import { Pin, Trash2 } from "lucide-react";
import type { Note } from "@/lib/types";

/** One row in the notes sidebar list. */
export default function NoteItem({ note, selected, onSelect, onPin, onDelete }: {
  note: Note;
  selected: boolean;
  onSelect: (note: Note) => void;
  onPin: (note: Note, e: React.MouseEvent) => void;
  onDelete: (noteId: string) => void;
}) {
  const preview = note.content
    ? note.content.replace(/<[^>]+>/g, "").slice(0, 60)
    : "No content";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={`group relative rounded-lg transition-colors ${
        selected ? "bg-zinc-800 text-white" : "hover:bg-zinc-900/60 text-zinc-300 hover:text-zinc-200"
      }`}
    >
      {/* The row itself is the button; the per-note actions sit alongside it
          rather than nested inside, which a button may not contain. */}
      <button
        type="button"
        onClick={() => onSelect(note)}
        aria-current={selected ? "true" : undefined}
        className="w-full rounded-lg px-2.5 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
      >
        <span className="mb-0.5 block max-w-[120px] truncate pr-12 text-xs font-semibold">
          {note.title}
        </span>
        <span className="block truncate text-[11px] text-zinc-400">{preview}</span>
      </button>
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 pointer-coarse:opacity-100 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={(e) => onPin(note, e)}
          aria-label={note.isPinned ? `Unpin ${note.title}` : `Pin ${note.title}`}
          className={`rounded p-0.5 hover:text-white focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
            note.isPinned ? "text-amber-400" : "text-zinc-400"
          }`}
        >
          <Pin className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
          aria-label={`Delete ${note.title}`}
          className="rounded p-0.5 text-zinc-400 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>
    </motion.div>
  );
}
