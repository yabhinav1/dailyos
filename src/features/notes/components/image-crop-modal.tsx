"use client";

import React, { useRef, useState } from "react";
import { Check, Crop, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Drag-to-crop overlay for an image in the note editor. */
export default function ImageCropModal({
  imageSrc,
  onClose,
  onCropComplete,
}: {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Crop box in percentage of image (x, y, w, h)
  const [crop, setCrop] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const dragState = useRef<{ mode: string; startX: number; startY: number; orig: typeof crop } | null>(null);

  const handlePointerDown = (e: React.PointerEvent, mode: string) => {
    e.stopPropagation();
    e.preventDefault();
    dragState.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...crop } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragState.current;
    if (!drag || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dxPercent = ((e.clientX - drag.startX) / rect.width) * 100;
    const dyPercent = ((e.clientY - drag.startY) / rect.height) * 100;

    let { x, y, w, h } = drag.orig;
    const minW = 10;
    const minH = 10;

    if (drag.mode === "move") {
      x = Math.min(Math.max(0, drag.orig.x + dxPercent), 100 - w);
      y = Math.min(Math.max(0, drag.orig.y + dyPercent), 100 - h);
    } else if (drag.mode === "se") {
      w = Math.min(Math.max(minW, drag.orig.w + dxPercent), 100 - x);
      h = Math.min(Math.max(minH, drag.orig.h + dyPercent), 100 - y);
    } else if (drag.mode === "sw") {
      const maxDx = drag.orig.w - minW;
      const actualDx = Math.min(dxPercent, maxDx);
      x = Math.max(0, drag.orig.x + actualDx);
      w = drag.orig.w - (x - drag.orig.x);
      h = Math.min(Math.max(minH, drag.orig.h + dyPercent), 100 - y);
    } else if (drag.mode === "ne") {
      w = Math.min(Math.max(minW, drag.orig.w + dxPercent), 100 - x);
      const maxDy = drag.orig.h - minH;
      const actualDy = Math.min(dyPercent, maxDy);
      y = Math.max(0, drag.orig.y + actualDy);
      h = drag.orig.h - (y - drag.orig.y);
    } else if (drag.mode === "nw") {
      const maxDx = drag.orig.w - minW;
      const actualDx = Math.min(dxPercent, maxDx);
      x = Math.max(0, drag.orig.x + actualDx);
      w = drag.orig.w - (x - drag.orig.x);

      const maxDy = drag.orig.h - minH;
      const actualDy = Math.min(dyPercent, maxDy);
      y = Math.max(0, drag.orig.y + actualDy);
      h = drag.orig.h - (y - drag.orig.y);
    }

    setCrop({ x, y, w, h });
  };

  const handlePointerUp = () => {
    dragState.current = null;
  };

  const handleApplyCrop = () => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    const naturalWidth = img.naturalWidth || img.width || 800;
    const naturalHeight = img.naturalHeight || img.height || 600;

    const cropX = (crop.x / 100) * naturalWidth;
    const cropY = (crop.y / 100) * naturalHeight;
    const cropW = (crop.w / 100) * naturalWidth;
    const cropH = (crop.h / 100) * naturalHeight;

    canvas.width = Math.max(10, cropW);
    canvas.height = Math.max(10, cropH);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
    onCropComplete(canvas.toDataURL("image/png"));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#171717] border border-zinc-800 rounded-xl p-5 max-w-xl w-full space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Crop className="h-4 w-4 text-zinc-200" /> Crop Image
          </h3>
          <span className="text-xs text-zinc-300 font-medium">Drag corner handles to adjust crop</span>
          <button onClick={onClose} className="text-zinc-300 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Canva Visual Drag-Crop Surface */}
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative overflow-hidden rounded-lg bg-zinc-950 flex items-center justify-center min-h-[260px] max-h-[380px] p-2 select-none touch-none"
        >
          {/* Crop source is a data: URL read straight off the canvas, and the
              ref is needed for drawImage — next/image fits neither. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop target"
            className="max-h-[360px] max-w-full object-contain pointer-events-none select-none"
            crossOrigin="anonymous"
          />

          {/* Draggable Crop Box Frame */}
          <div
            onPointerDown={(e) => handlePointerDown(e, "move")}
            className="absolute border-2 border-white cursor-move shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.w}%`,
              height: `${crop.h}%`,
            }}
          >
            {/* Rule-of-thirds grid */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-25">
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-white" />
              <div className="border-r border-white" />
              <div />
            </div>

            {/* Corner Handles */}
            <div
              onPointerDown={(e) => handlePointerDown(e, "nw")}
              className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-zinc-900 rounded-sm cursor-nwse-resize hover:scale-125 transition-transform"
            />
            <div
              onPointerDown={(e) => handlePointerDown(e, "ne")}
              className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-zinc-900 rounded-sm cursor-nesw-resize hover:scale-125 transition-transform"
            />
            <div
              onPointerDown={(e) => handlePointerDown(e, "sw")}
              className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-zinc-900 rounded-sm cursor-nesw-resize hover:scale-125 transition-transform"
            />
            <div
              onPointerDown={(e) => handlePointerDown(e, "se")}
              className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-zinc-900 rounded-sm cursor-nwse-resize hover:scale-125 transition-transform"
            />
          </div>
        </div>

        {/* Quick Aspect Presets & Action Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-300">
            <span className="text-[11px] uppercase font-bold text-zinc-400">Presets:</span>
            <button
              onClick={() => setCrop({ x: 0, y: 0, w: 100, h: 100 })}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium"
            >
              Full Image
            </button>
            <button
              onClick={() => setCrop({ x: 25, y: 25, w: 50, h: 50 })}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium"
            >
              Center 1:1
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="border-zinc-800 text-zinc-300 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleApplyCrop} className="text-xs gap-1.5 font-semibold">
              <Check className="h-3.5 w-3.5" /> Done Crop
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
