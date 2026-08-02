"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Eraser, Download, Trash2, ImagePlus, X, PaintBucket, PanelTop, PanelLeft, Crop } from "lucide-react";
import ColorPicker from "./color-picker";

const COLORS = ["#f4f4f5", "#3b82f6", "#22d3ee", "#a855f7", "#ec4899", "#ef4444", "#22c55e", "#eab308", "#000000"];
const BG_PRESETS = ["#0d0d0d", "#111827", "#1e1b4b", "#0c1e2e", "#f4f4f5", "#ffffff"];
const BRUSH_SIZES = [2, 4, 8, 14];

interface FloatingImage {
  id: string;
  src: string;
  el: HTMLImageElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

type ToolbarPosition = "top" | "side";

interface DoodleCanvasProps {
  value?: string | null;
  onChange?: (dataUrl: string) => void;
  /** Fixed pixel height for the canvas surface. Ignored when fillContainer is true. */
  height?: number;
  /**
   * When true, the canvas surface stretches to fill its parent (width AND
   * height) instead of using a fixed `height` — use this to make the whole
   * background a whiteboard. The parent needs a defined height (e.g. a
   * flex-1 / h-full ancestor) for this to have something to fill.
   */
  fillContainer?: boolean;
  /** Starting position of the toolbar; the user can toggle it afterwards. */
  defaultToolbarPosition?: ToolbarPosition;
  className?: string;
}

export default function DoodleCanvas({
  value,
  onChange,
  height = 420,
  fillContainer = false,
  defaultToolbarPosition = "top",
  className = "",
}: DoodleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const loadedValueRef = useRef<string | null>(null);
  // Tracks the container's last-known CSS pixel size so we can rescale the
  // drawing (and floating images) when the container is resized instead of
  // wiping it, since a <canvas> loses its bitmap whenever width/height change.
  const lastSizeRef = useRef<{ w: number; h: number } | null>(null);

  const [color, setColor] = useState(COLORS[1]);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [bgColor, setBgColor] = useState(BG_PRESETS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isErasing, setIsErasing] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<ToolbarPosition>(defaultToolbarPosition);

  const [images, setImages] = useState<FloatingImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragState = useRef<{ id: string; mode: "move" | "nw" | "ne" | "sw" | "se"; startX: number; startY: number; orig: FloatingImage } | null>(null);

  const pushRecentColor = useCallback((c: string) => {
    setRecentColors((prev) => [c, ...prev.filter((p) => p !== c)].slice(0, 6));
  }, []);

  // Resize the canvas's backing bitmap to a new CSS size, preserving
  // whatever was already drawn by redrawing it scaled into the new size.
  const resizeCanvasTo = useCallback((width: number, heightPx: number) => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || heightPx <= 0) return;
    const dpr = window.devicePixelRatio || 1;

    // Snapshot the current bitmap (if any) before we resize the backing store.
    let snapshot: HTMLCanvasElement | null = null;
    if (canvas.width > 0 && canvas.height > 0) {
      snapshot = document.createElement("canvas");
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
    }

    canvas.width = width * dpr;
    canvas.height = heightPx * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${heightPx}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    if (snapshot) {
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, width, heightPx);
    }

    const prev = lastSizeRef.current;
    if (prev && prev.w > 0 && prev.h > 0 && (prev.w !== width || prev.h !== heightPx)) {
      // Reposition floating images proportionally so they stay roughly
      // where they were relative to the whiteboard, not clipped off-canvas.
      const sx = width / prev.w;
      const sy = heightPx / prev.h;
      setImages((imgs) => imgs.map((img) => ({ ...img, x: img.x * sx, y: img.y * sy, w: img.w * sx, h: img.h * sy })));
    }
    lastSizeRef.current = { w: width, h: heightPx };
  }, []);

  // Initial sizing + reload of the saved doodle.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    const h = fillContainer ? container.clientHeight : height;
    if (width <= 0 || h <= 0) return;

    resizeCanvasTo(width, h);

    if (value && value !== loadedValueRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const img = new Image();
      img.onload = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, h);
        ctx.drawImage(img, 0, 0, width, h);

        // Best-effort restore of the saved background color: sample the
        // top-left corner pixel of the loaded composite (background is
        // always painted first, full-bleed, before strokes/images), so a
        // reloaded doodle keeps showing the color it was saved with
        // instead of silently reverting to the BG_PRESETS[0] default.
        try {
          const sampleCanvas = document.createElement("canvas");
          sampleCanvas.width = 1;
          sampleCanvas.height = 1;
          const sctx = sampleCanvas.getContext("2d");
          if (sctx) {
            sctx.drawImage(img, 0, 0, 1, 1);
            const [r, g, b, a] = sctx.getImageData(0, 0, 1, 1).data;
            if (a > 0) {
              const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
              setBgColor(hex);
            }
          }
        } catch {
          // Canvas may be tainted (cross-origin image) or sampling can
          // otherwise fail; keep the default bgColor in that case.
        }
      };
      img.src = value;
      loadedValueRef.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the canvas filling its container when fillContainer is set, and
  // stay correctly sized if the fixed height prop changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!fillContainer) {
      resizeCanvasTo(container.clientWidth, height);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height: h } = entry.contentRect;
      if (width > 0 && h > 0) resizeCanvasTo(Math.floor(width), Math.floor(h));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fillContainer, height, resizeCanvasTo]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Composite the base strokes canvas + background color + any floating
  // images into a single flattened PNG data URL (used for saving/exporting).
  const exportComposite = useCallback((overrideBg?: string): string => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    const dpr = window.devicePixelRatio || 1;
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const octx = out.getContext("2d");
    if (!octx) return canvas.toDataURL("image/png");

    // overrideBg lets callers (e.g. handleBgChange) pass the *new* color
    // directly instead of relying on `bgColor` state, which may not have
    // committed yet in the same synchronous tick (React batches setState).
    octx.fillStyle = overrideBg ?? bgColor;
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(canvas, 0, 0);
    for (const img of images) {
      if (img.el.complete) {
        octx.drawImage(img.el, img.x * dpr, img.y * dpr, img.w * dpr, img.h * dpr);
      }
    }
    return out.toDataURL("image/png");
  }, [bgColor, images]);

  const commitChange = useCallback((overrideBg?: string) => {
    if (!onChange) return;
    const dataUrl = exportComposite(overrideBg);
    loadedValueRef.current = dataUrl;
    onChange(dataUrl);
  }, [onChange, exportComposite]);

  // Fire onChange whenever an image moves/resizes so the parent stays in sync.
  useEffect(() => {
    if (images.length > 0) commitChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setSelectedId(null);
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const point = getPoint(e);
    const last = lastPointRef.current || point;

    if (isErasing) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = brushSize * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    lastPointRef.current = point;
  };

  // Add an uploaded/pasted image as a freely movable + resizable layer.
  const insertImage = useCallback((src: string) => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    const h = fillContainer ? container.clientHeight : height;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min((width * 0.7) / img.width, (h * 0.7) / img.height, 1);
      const w = img.width * scale;
      const ih = img.height * scale;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newImage: FloatingImage = {
        id,
        src,
        el: img,
        x: (width - w) / 2,
        y: (h - ih) / 2,
        w,
        h: ih,
      };
      setImages((prev) => [...prev, newImage]);
      setSelectedId(id);
    };
    img.src = src;
  }, [height, fillContainer]);

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => insertImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Paste an image from the clipboard (Ctrl+V) directly onto the canvas
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => insertImage(reader.result as string);
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [insertImage]);

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    commitChange();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setImages([]);
    setSelectedId(null);
    commitChange();
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.download = "doodle.png";
    link.href = exportComposite();
    link.click();
  };

  const handleDeleteImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Bring the selected image to the front (end of array = painted last).
  const bringToFront = (id: string) => {
    setImages((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.push(item);
      return next;
    });
  };

  // ---- Image drag / resize ----
  const startDrag = (
    e: React.PointerEvent,
    id: string,
    mode: "move" | "nw" | "ne" | "sw" | "se"
  ) => {
    e.stopPropagation();
    const img = images.find((i) => i.id === id);
    if (!img) return;
    setSelectedId(id);
    bringToFront(id);
    dragState.current = { id, mode, startX: e.clientX, startY: e.clientY, orig: { ...img } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  useEffect(() => {
    const container = containerRef.current;

    const handleMove = (e: PointerEvent) => {
      const drag = dragState.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const maxW = container?.clientWidth ?? 10000;
      const maxH = lastSizeRef.current?.h ?? (fillContainer ? (container?.clientHeight ?? 10000) : height);
      const minSize = 24;

      setImages((prev) =>
        prev.map((img) => {
          if (img.id !== drag.id) return img;
          const o = drag.orig;
          let { x, y, w, h } = o;

          if (drag.mode === "move") {
            x = Math.min(Math.max(o.x + dx, -w + 20), maxW - 20);
            y = Math.min(Math.max(o.y + dy, -h + 20), maxH - 20);
          } else if (drag.mode === "se") {
            w = Math.max(minSize, o.w + dx);
            h = Math.max(minSize, o.h + dy);
          } else if (drag.mode === "sw") {
            w = Math.max(minSize, o.w - dx);
            h = Math.max(minSize, o.h + dy);
            x = o.x + (o.w - w);
          } else if (drag.mode === "ne") {
            w = Math.max(minSize, o.w + dx);
            h = Math.max(minSize, o.h - dy);
            y = o.y + (o.h - h);
          } else if (drag.mode === "nw") {
            w = Math.max(minSize, o.w - dx);
            h = Math.max(minSize, o.h - dy);
            x = o.x + (o.w - w);
            y = o.y + (o.h - h);
          } else if (drag.mode === "e") {
            w = Math.max(minSize, o.w + dx);
          } else if (drag.mode === "w") {
            w = Math.max(minSize, o.w - dx);
            x = o.x + (o.w - w);
          } else if (drag.mode === "s") {
            h = Math.max(minSize, o.h + dy);
          } else if (drag.mode === "n") {
            h = Math.max(minSize, o.h - dy);
            y = o.y + (o.h - h);
          }
          return { ...img, x, y, w, h };
        })
      );
    };

    const handleUp = () => {
      dragState.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [height, fillContainer]);

  const handleColorChange = (c: string) => {
    setColor(c);
    setIsErasing(false);
    pushRecentColor(c);
  };

  const handleBgChange = (c: string) => {
    setBgColor(c);
    commitChange(c);
  };

  const isSide = toolbarPos === "side";

  const toolbar = (
    <div
      className={`flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 ${
        isSide ? "flex-col items-stretch overflow-y-auto" : "flex-wrap items-center"
      }`}
    >
      <button
        onClick={() => setToolbarPos(isSide ? "top" : "side")}
        title={isSide ? "Move toolbar to top" : "Move toolbar to side"}
        className="flex items-center gap-1.5 self-start rounded px-1.5 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
      >
        {isSide ? <PanelTop className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
        {isSide ? "Top" : "Side"}
      </button>

      <div className={isSide ? "h-px w-full bg-zinc-800" : "h-4 w-px bg-zinc-800"} />

      <div className={`flex items-center gap-1.5 ${isSide ? "flex-wrap" : ""}`}>
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => handleColorChange(c)}
            className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
              !isErasing && color === c ? "border-white scale-110" : "border-zinc-700"
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        ))}
        <ColorPicker value={color} onChange={handleColorChange} recent={recentColors} />
      </div>

      <div className={isSide ? "h-px w-full bg-zinc-800" : "h-4 w-px bg-zinc-800"} />

      <div className="flex items-center gap-1.5">
        {BRUSH_SIZES.map((s) => (
          <button
            key={s}
            onClick={() => setBrushSize(s)}
            className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
              brushSize === s ? "bg-zinc-800" : "hover:bg-zinc-900"
            }`}
            aria-label={`Brush size ${s}`}
          >
            <span className="rounded-full bg-zinc-300" style={{ width: s, height: s }} />
          </button>
        ))}
      </div>

      <div className={isSide ? "h-px w-full bg-zinc-800" : "h-4 w-px bg-zinc-800"} />

      <button
        onClick={() => setIsErasing((v) => !v)}
        className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
          isErasing ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
        }`}
      >
        <Eraser className="h-3.5 w-3.5" />
        Eraser
      </button>

      <div className={isSide ? "h-px w-full bg-zinc-800" : "h-4 w-px bg-zinc-800"} />

      {/* Background color */}
      <div className={`flex items-center gap-1.5 ${isSide ? "flex-wrap" : ""}`}>
        <PaintBucket className="h-3.5 w-3.5 text-zinc-500" />
        {BG_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => handleBgChange(c)}
            className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
              bgColor === c ? "border-white scale-110" : "border-zinc-700"
            }`}
            style={{ backgroundColor: c }}
            aria-label={`Background ${c}`}
          />
        ))}
        <ColorPicker value={bgColor} onChange={handleBgChange} />
      </div>

      <div className={`flex items-center gap-1.5 ${isSide ? "flex-col items-stretch" : "ml-auto"}`}>
        <label className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors cursor-pointer">
          <ImagePlus className="h-3.5 w-3.5" />
          Add Image
          <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />
        </label>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Save PNG
        </button>
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-zinc-400 hover:bg-red-950/40 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className={`flex gap-3 ${isSide ? "flex-row" : "flex-col"} ${fillContainer ? "h-full w-full" : ""} ${className}`}
    >
      <div className={isSide ? "w-52 shrink-0" : ""}>{toolbar}</div>

      {!isSide && (
        <p className="text-[10px] text-zinc-600 -mt-1">
          Tip: paste an image (Ctrl+V), then drag it or pull its 8 Canva handles to resize and move freely.
        </p>
      )}

      {/* Canvas surface */}
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-lg border border-zinc-800 ${fillContainer ? "flex-1 w-full min-h-0" : "w-full"}`}
        style={fillContainer ? { backgroundColor: bgColor } : { height, backgroundColor: bgColor }}
        onPointerDown={() => setSelectedId(null)}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="absolute inset-0 touch-none cursor-crosshair"
        />

        {images.map((img) => {
          const isSelected = selectedId === img.id;
          return (
            <div
              key={img.id}
              className={`absolute select-none ${isSelected ? "border-2 border-white ring-1 ring-black/40" : ""}`}
              style={{ left: img.x, top: img.y, width: img.w, height: img.h }}
            >
              <img
                src={img.src}
                alt=""
                draggable={false}
                onPointerDown={(e) => startDrag(e, img.id, "move")}
                className={`h-full w-full select-none object-fill ${
                  isSelected ? "cursor-move" : "cursor-pointer"
                }`}
              />
              {isSelected && (
                <>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => handleDeleteImage(img.id)}
                    className="absolute -top-3 -right-3 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-black/80 hover:bg-red-500 transition-transform hover:scale-110 z-10"
                    aria-label="Delete image"
                    title="Delete Image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      const fileInput = document.createElement("input");
                      fileInput.type = "file";
                      fileInput.accept = "image/*";
                      fileInput.onchange = (e: any) => {
                        const file = e.target?.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const newSrc = reader.result as string;
                            setImages((prev) =>
                              prev.map((item) => {
                                if (item.id === img.id) {
                                  const newImg = new Image();
                                  newImg.src = newSrc;
                                  return { ...item, src: newSrc, el: newImg };
                                }
                                return item;
                              })
                            );
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      fileInput.click();
                    }}
                    className="absolute -top-3 -left-3 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-zinc-800 text-white shadow-lg shadow-black/80 hover:bg-zinc-700 transition-transform hover:scale-110 border border-zinc-700 z-10"
                    aria-label="Replace image"
                    title="Replace / Edit Image"
                  >
                    <Crop className="h-3 w-3" />
                  </button>

                  {/* 4 Canva Corner Handles */}
                  <div
                    onPointerDown={(e) => startDrag(e, img.id, "nw")}
                    className="absolute -top-2 -left-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                  />
                  <div
                    onPointerDown={(e) => startDrag(e, img.id, "ne")}
                    className="absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                  />
                  <div
                    onPointerDown={(e) => startDrag(e, img.id, "sw")}
                    className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                  />
                  <div
                    onPointerDown={(e) => startDrag(e, img.id, "se")}
                    className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                  />

                  {/* 4 Canva Side Handles */}
                  <div
                    onPointerDown={(e) => startDrag(e, img.id, "n")}
                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ns-resize hover:scale-125 transition-transform"
                  />
                  <div
                    onPointerDown={(e) => startDrag(e, img.id, "s")}
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ns-resize hover:scale-125 transition-transform"
                  />
                  <div
                    onPointerDown={(e) => startDrag(e, img.id, "w")}
                    className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ew-resize hover:scale-125 transition-transform"
                  />
                  <div
                    onPointerDown={(e) => startDrag(e, img.id, "e")}
                    className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ew-resize hover:scale-125 transition-transform"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
