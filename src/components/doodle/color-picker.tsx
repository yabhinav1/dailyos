"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

// ---- color math helpers ----

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let clean = hex.replace("#", "");
  if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
  const r = parseInt(clean.slice(0, 2), 16) / 255 || 0;
  const g = parseInt(clean.slice(2, 4), 16) / 255 || 0;
  const b = parseInt(clean.slice(4, 6), 16) / 255 || 0;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

const SWATCHES = [
  "#f4f4f5", "#94a3b8", "#3b82f6", "#06b6d4", "#22d3ee",
  "#8b5cf6", "#a855f7", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#000000", "#0d0d0d",
];

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  recent?: string[];
  align?: "left" | "right";
}

export default function ColorPicker({ value, onChange, recent = [], align = "left" }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexInput, setHexInput] = useState(value);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const draggingSv = useRef(false);
  const draggingHue = useRef(false);

  // Re-sync from the `value` prop by adjusting state during render — React's
  // documented alternative to a prop-watching effect, and one render cheaper.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setHsv(hexToHsv(value));
    setHexInput(value);
  }

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const applyHsv = useCallback((h: number, s: number, v: number) => {
    setHsv({ h, s, v });
    const hex = hsvToHex(h, s, v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleSvPoint = useCallback((clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    const s = x / rect.width;
    const v = 1 - y / rect.height;
    applyHsv(hsv.h, s, v);
  }, [applyHsv, hsv.h]);

  const handleHuePoint = useCallback((clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const h = (x / rect.width) * 360;
    applyHsv(h, hsv.s, hsv.v);
  }, [applyHsv, hsv.s, hsv.v]);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (draggingSv.current) handleSvPoint(e.clientX, e.clientY);
      if (draggingHue.current) handleHuePoint(e.clientX);
    };
    const handleUp = () => {
      draggingSv.current = false;
      draggingHue.current = false;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [handleSvPoint, handleHuePoint]);

  const commitHex = (raw: string) => {
    setHexInput(raw);
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
      setHsv(hexToHsv(raw));
      onChange(raw);
    }
  };

  const pureHue = hsvToHex(hsv.h, 1, 1);

  return (
    <div className="relative">
      <button
        type="button"
        title="Custom color"
        onClick={() => setOpen((v) => !v)}
        className="relative h-6 w-6 rounded-full border border-zinc-700 overflow-hidden cursor-pointer shrink-0 ring-offset-1 ring-offset-zinc-950 transition-transform hover:scale-110"
        style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
      >
        <span className="absolute inset-[3px] rounded-full border border-black/20" style={{ backgroundColor: value }} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`absolute z-50 top-8 ${align === "right" ? "right-0" : "left-0"} w-56 rounded-xl border border-zinc-800 bg-[#141417] p-3 shadow-2xl shadow-black/50 space-y-3`}
        >
          {/* Saturation / Value square */}
          <div
            ref={svRef}
            onPointerDown={(e) => {
              draggingSv.current = true;
              handleSvPoint(e.clientX, e.clientY);
            }}
            className="relative h-32 w-full rounded-lg cursor-crosshair touch-none select-none"
            style={{
              backgroundColor: pureHue,
              backgroundImage:
                "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
            }}
          >
            <div
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow shadow-black/60"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                backgroundColor: value,
              }}
            />
          </div>

          {/* Hue slider */}
          <div
            ref={hueRef}
            onPointerDown={(e) => {
              draggingHue.current = true;
              handleHuePoint(e.clientX);
            }}
            className="relative h-3 w-full rounded-full cursor-pointer touch-none select-none"
            style={{
              background:
                "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            }}
          >
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow shadow-black/60"
              style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: pureHue }}
            />
          </div>

          {/* Hex input + preview */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 shrink-0 rounded-md border border-zinc-700" style={{ backgroundColor: value }} />
            <input
              value={hexInput}
              onChange={(e) => commitHex(e.target.value)}
              spellCheck={false}
              className="h-7 flex-1 min-w-0 rounded-md border border-zinc-800 bg-zinc-900/70 px-2 text-xs font-mono text-zinc-200 outline-none focus:border-blue-600"
            />
          </div>

          {/* Preset swatches */}
          <div className="grid grid-cols-8 gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setHsv(hexToHsv(c));
                  setHexInput(c);
                }}
                className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
                  value.toLowerCase() === c ? "border-white scale-110" : "border-zinc-700/70"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Preset ${c}`}
              />
            ))}
          </div>

          {recent.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Recent</p>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((c, i) => (
                  <button
                    key={`${c}-${i}`}
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setHsv(hexToHsv(c));
                      setHexInput(c);
                    }}
                    className="h-5 w-5 rounded-full border border-zinc-700/70 transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                    aria-label={`Recent ${c}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
