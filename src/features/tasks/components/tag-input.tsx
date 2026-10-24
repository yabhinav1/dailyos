"use client";

import React, { useId, useState } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  disabled?: boolean;
}

/** Chips plus a free-text box: Enter or comma adds, Backspace on empty removes. */
export default function TagInput({ value, onChange, suggestions = [], disabled }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  const add = (raw: string) => {
    const name = raw.trim().replace(/^#/, "").slice(0, 40);
    if (!name || value.some((t) => t.toLowerCase() === name.toLowerCase())) return;
    onChange([...value, name]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
      setDraft("");
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-9 px-2 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 focus-within:border-zinc-700">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-200">
          #{tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-zinc-400 hover:text-white"
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        // A tag typed and left without pressing Enter still counts.
        onBlur={() => {
          add(draft);
          setDraft("");
        }}
        placeholder={value.length ? "" : "Add tags…"}
        aria-label="Add a tag"
        className="flex-1 min-w-[80px] bg-transparent text-xs text-white placeholder-zinc-400 outline-none"
        disabled={disabled}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
