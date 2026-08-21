"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, Type } from "lucide-react";

/**
 * A freeform text surface: double-click (or press the Add text button) to drop
 * a text block anywhere, then drag it around. Blocks serialise to JSON so a
 * note can round-trip the whole board through a single text column.
 */
export type TextBlock = {
  id: string;
  x: number;
  y: number;
  text: string;
};

const MIN_BLOCK_WIDTH = 180;

/** Tolerates null, empty strings and anything malformed — a corrupt board
 *  should render as empty rather than take the editor down. */
export function parseBlocks(raw: string | null | undefined): TextBlock[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): TextBlock[] => {
      if (!item || typeof item !== "object") return [];
      const { id, x, y, text } = item as Record<string, unknown>;
      if (typeof id !== "string") return [];
      if (typeof x !== "number" || typeof y !== "number") return [];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
      return [{ id, x, y, text: typeof text === "string" ? text : "" }];
    });
  } catch {
    return [];
  }
}

export function serializeBlocks(blocks: TextBlock[]): string {
  return JSON.stringify(blocks);
}

function newId() {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function FreeformCanvas({
  value,
  onChange,
  className = "",
}: {
  value: string | null;
  onChange: (next: string) => void;
  className?: string;
}) {
  const [blocks, setBlocks] = useState<TextBlock[]>(() => parseBlocks(value));
  const [activeId, setActiveId] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Re-hydrate when the caller switches to a different note. Comparing against
  // the serialised form keeps our own onChange echoes from clobbering an edit
  // in progress.
  const lastSyncedRef = useRef(value);
  useEffect(() => {
    if (value === lastSyncedRef.current) return;
    lastSyncedRef.current = value;
    setBlocks(parseBlocks(value));
  }, [value]);

  const commit = useCallback(
    (next: TextBlock[]) => {
      setBlocks(next);
      const json = serializeBlocks(next);
      lastSyncedRef.current = json;
      onChange(json);
    },
    [onChange]
  );

  const addBlock = useCallback(
    (x: number, y: number) => {
      const block: TextBlock = { id: newId(), x, y, text: "" };
      commit([...blocks, block]);
      setActiveId(block.id);
    },
    [blocks, commit]
  );

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only when the surface itself was hit, never a block on top of it.
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    addBlock(e.clientX - rect.left, e.clientY - rect.top);
  };

  const updateText = (id: string, text: string) => {
    commit(blocks.map((b) => (b.id === id ? { ...b, text } : b)));
  };

  const removeBlock = (id: string) => {
    commit(blocks.filter((b) => b.id !== id));
    setActiveId((current) => (current === id ? null : current));
  };

  // Drag with pointer events so mouse, pen and touch all work from one path.
  const startDrag = (e: React.PointerEvent, block: TextBlock) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    dragRef.current = {
      id: block.id,
      offsetX: e.clientX - rect.left - block.x,
      offsetY: e.clientY - rect.top - block.y,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setActiveId(block.id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const surface = surfaceRef.current;
    if (!drag || !surface) return;
    const rect = surface.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - drag.offsetX, rect.width - MIN_BLOCK_WIDTH));
    const y = Math.max(0, Math.min(e.clientY - rect.top - drag.offsetY, rect.height - 32));
    setBlocks((prev) => prev.map((b) => (b.id === drag.id ? { ...b, x, y } : b)));
  };

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const json = serializeBlocks(blocks);
    lastSyncedRef.current = json;
    onChange(json);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={`relative flex h-full w-full flex-col ${className}`}>
      <div className="flex shrink-0 items-center gap-2 pb-2">
        <button
          type="button"
          onClick={() => addBlock(48, 48 + blocks.length * 12)}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <Type className="h-3.5 w-3.5" /> Add text
        </button>
        <p className="text-[11px] text-zinc-600">
          Double-click anywhere to write. Drag to move.
        </p>
      </div>

      <div
        ref={surfaceRef}
        onDoubleClick={handleDoubleClick}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-[radial-gradient(circle,rgba(120,120,130,0.18)_1px,transparent_1px)] [background-size:22px_22px] dark:border-zinc-900 dark:bg-[#0b0b0f]"
      >
        {blocks.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-zinc-500">Nothing here yet</p>
            <p className="text-[11px] text-zinc-600">
              Double-click anywhere on the grid to start writing.
            </p>
          </div>
        )}

        {blocks.map((block) => {
          const isActive = block.id === activeId;
          return (
            <div
              key={block.id}
              style={{ transform: `translate(${block.x}px, ${block.y}px)` }}
              className="absolute left-0 top-0 group"
            >
              <div
                className={`relative rounded-lg border transition-colors duration-150 ${
                  isActive
                    ? "border-blue-500/60 bg-white/[0.03]"
                    : "border-transparent hover:border-zinc-700/60"
                }`}
              >
                {/* Drag handle doubles as the block's focus target. */}
                <div
                  onPointerDown={(e) => startDrag(e, block)}
                  className="absolute -left-1 top-0 h-full w-1.5 cursor-grab rounded-l active:cursor-grabbing"
                  aria-hidden="true"
                />
                <textarea
                  value={block.text}
                  onChange={(e) => updateText(block.id, e.target.value)}
                  onFocus={() => setActiveId(block.id)}
                  rows={Math.max(1, block.text.split("\n").length)}
                  placeholder="Write…"
                  aria-label="Canvas text block"
                  className="w-[220px] resize-none bg-transparent px-2.5 py-1.5 text-sm leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-600 dark:text-zinc-100"
                />
                {isActive && (
                  <button
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    aria-label="Delete this text block"
                    className="absolute -right-2 -top-2 rounded-full border border-zinc-700 bg-zinc-900 p-1 text-zinc-400 transition-colors hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <span className="sr-only" aria-live="polite">
        {blocks.length} text {blocks.length === 1 ? "block" : "blocks"} on canvas
      </span>
    </div>
  );
}
