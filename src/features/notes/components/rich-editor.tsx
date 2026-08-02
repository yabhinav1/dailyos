"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Image from "@tiptap/extension-image";
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Quote, Code, Undo, Redo, Highlighter, ImagePlus,
  Crop, Trash2, Check, X, Maximize, AlignLeft, AlignCenter, AlignRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RichEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

function ImageCropModal({
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
            <Crop className="h-4 w-4 text-zinc-300" /> Crop Image
          </h3>
          <span className="text-[11px] text-zinc-400 font-medium">Drag corner handles to adjust crop</span>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1">
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
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="text-[10px] uppercase font-bold text-zinc-500">Presets:</span>
            <button
              onClick={() => setCrop({ x: 0, y: 0, w: 100, h: 100 })}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium"
            >
              Full Image
            </button>
            <button
              onClick={() => setCrop({ x: 25, y: 25, w: 50, h: 50 })}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium"
            >
              Center 1:1
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="border-zinc-800 text-zinc-400 text-xs">
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

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors text-xs ${
        isActive
          ? "bg-zinc-800 text-white font-semibold"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichEditor({ content, onChange, placeholder = "Start writing..." }: RichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedImgSrc, setSelectedImgSrc] = useState<string | null>(null);
  const [selectedImgElement, setSelectedImgElement] = useState<HTMLImageElement | null>(null);
  const [croppingImgSrc, setCroppingImgSrc] = useState<string | null>(null);
  const [imgRect, setImgRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const updateImgRect = () => {
    if (selectedImgElement && editorContainerRef.current) {
      const parent = editorContainerRef.current.getBoundingClientRect();
      const child = selectedImgElement.getBoundingClientRect();
      setImgRect({
        left: child.left - parent.left,
        top: child.top - parent.top,
        width: child.width,
        height: child.height,
      });
    } else {
      setImgRect(null);
    }
  };

  useEffect(() => {
    updateImgRect();
    window.addEventListener("resize", updateImgRect);
    return () => window.removeEventListener("resize", updateImgRect);
  }, [selectedImgElement]);

  const handleHandlePointerDown = (e: React.PointerEvent, mode: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!selectedImgElement || !imgRect) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = imgRect.width;
    const startH = imgRect.height;
    const target = e.target as HTMLElement;

    const handlePointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newW = startW;
      let newH = startH;

      if (mode === "se") {
        newW = Math.max(40, startW + dx);
        newH = Math.max(40, startH + dy);
      } else if (mode === "sw") {
        newW = Math.max(40, startW - dx);
        newH = Math.max(40, startH + dy);
      } else if (mode === "ne") {
        newW = Math.max(40, startW + dx);
        newH = Math.max(40, startH - dy);
      } else if (mode === "nw") {
        newW = Math.max(40, startW - dx);
        newH = Math.max(40, startH - dy);
      } else if (mode === "e") {
        newW = Math.max(40, startW + dx);
      } else if (mode === "w") {
        newW = Math.max(40, startW - dx);
      } else if (mode === "s") {
        newH = Math.max(40, startH + dy);
      } else if (mode === "n") {
        newH = Math.max(40, startH - dy);
      }

      selectedImgElement.style.width = `${newW}px`;
      selectedImgElement.style.height = `${newH}px`;
      updateImgRect();
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (editor) onChange(editor.getHTML());
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleAlignImage = (align: "left" | "center" | "right") => {
    if (selectedImgElement) {
      if (align === "left") {
        selectedImgElement.style.marginLeft = "0";
        selectedImgElement.style.marginRight = "auto";
        selectedImgElement.style.display = "block";
      } else if (align === "center") {
        selectedImgElement.style.marginLeft = "auto";
        selectedImgElement.style.marginRight = "auto";
        selectedImgElement.style.display = "block";
      } else if (align === "right") {
        selectedImgElement.style.marginLeft = "auto";
        selectedImgElement.style.marginRight = "0";
        selectedImgElement.style.display = "block";
      }
      updateImgRect();
      if (editor) onChange(editor.getHTML());
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: false }),
      Typography,
      Image.configure({ inline: false, HTMLAttributes: { class: "rounded-lg max-w-full cursor-pointer hover:ring-2 hover:ring-white/50 transition-all" } }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[300px] h-full px-4 py-3 text-sm leading-relaxed text-zinc-300",
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              insertImageFile(file);
              event.preventDefault();
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (imageFile) {
          insertImageFile(imageFile);
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  });

  const insertImageFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("Please choose an image under 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      editor?.chain().focus().setImage({ src: reader.result as string }).run();
    };
    reader.readAsDataURL(file);
  };

  const handleImageButtonClick = () => fileInputRef.current?.click();

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) insertImageFile(file);
    e.target.value = "";
  };

  // Listen for clicks on images in the editor to activate Canva-style image toolbar
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const img = target as HTMLImageElement;
      setSelectedImgSrc(img.src);
      setSelectedImgElement(img);
      setTimeout(updateImgRect, 50);
    } else {
      setSelectedImgSrc(null);
      setSelectedImgElement(null);
      setImgRect(null);
    }

    if (editor && e.target === e.currentTarget) {
      editor.chain().focus("end").run();
    }
  };

  const handleCropComplete = (croppedDataUrl: string) => {
    if (!editor || !selectedImgSrc) return;
    if (selectedImgElement) {
      selectedImgElement.src = croppedDataUrl;
      onChange(editor.getHTML());
      setTimeout(updateImgRect, 50);
    } else {
      editor.chain().focus().setImage({ src: croppedDataUrl }).run();
    }
    setSelectedImgSrc(croppedDataUrl);
  };

  const handleResizeImage = (widthPercent: number) => {
    if (selectedImgElement) {
      selectedImgElement.style.width = `${widthPercent}%`;
      selectedImgElement.style.height = "auto";
      updateImgRect();
      onChange(editor.getHTML());
    }
  };

  const handleDeleteSelectedImage = () => {
    if (selectedImgElement) {
      selectedImgElement.remove();
      setSelectedImgSrc(null);
      setSelectedImgElement(null);
      setImgRect(null);
      if (editor) onChange(editor.getHTML());
    }
  };

  // Keep editor content in sync when prop changes externally (e.g. note switched)
  const lastContent = useRef(content);
  useEffect(() => {
    if (editor && content !== lastContent.current && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
      lastContent.current = content;
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div ref={editorContainerRef} className="flex flex-col h-full border border-zinc-800 rounded-xl bg-[#171717] overflow-hidden relative">
      {/* Crop Modal */}
      {croppingImgSrc && (
        <ImageCropModal
          imageSrc={croppingImgSrc}
          onClose={() => setCroppingImgSrc(null)}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* Canva 8-Handle Bounding Box Overlay for Selected Editor Image */}
      {imgRect && selectedImgElement && (
        <div
          className="absolute border-2 border-white pointer-events-none z-30 ring-1 ring-black/50"
          style={{
            left: `${imgRect.left}px`,
            top: `${imgRect.top}px`,
            width: `${imgRect.width}px`,
            height: `${imgRect.height}px`,
          }}
        >
          {/* 4 Corner Circular Handles */}
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "nw")}
            className="absolute -top-2 -left-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "ne")}
            className="absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "sw")}
            className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "se")}
            className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
          />

          {/* 4 Side Handles */}
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "n")}
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ns-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "s")}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ns-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "w")}
            className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ew-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "e")}
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ew-resize pointer-events-auto hover:scale-125 transition-transform"
          />
        </div>
      )}

      {/* Canva-style Floating Image Action Toolbar */}
      {selectedImgSrc && (
        <div className="absolute top-12 right-4 z-40 flex items-center gap-1.5 p-1.5 rounded-lg border border-zinc-800 bg-zinc-950/90 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <span className="text-[10px] font-bold text-zinc-400 px-1.5 uppercase tracking-wider">Image Options</span>
          <div className="w-px h-3.5 bg-zinc-800" />
          <button
            onClick={() => setCroppingImgSrc(selectedImgSrc)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors"
            title="Crop this image"
          >
            <Crop className="h-3.5 w-3.5" />
            <span>Crop</span>
          </button>

          <div className="w-px h-3.5 bg-zinc-800" />

          {/* Alignment */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => handleAlignImage("left")} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Align Left">
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => handleAlignImage("center")} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Align Center">
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => handleAlignImage("right")} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Align Right">
              <AlignRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="w-px h-3.5 bg-zinc-800" />

          {/* Size presets */}
          <div className="flex items-center gap-1 text-[10px] font-medium text-zinc-400">
            <button onClick={() => handleResizeImage(33)} className="px-1.5 py-0.5 rounded hover:bg-zinc-800 hover:text-white">33%</button>
            <button onClick={() => handleResizeImage(50)} className="px-1.5 py-0.5 rounded hover:bg-zinc-800 hover:text-white">50%</button>
            <button onClick={() => handleResizeImage(100)} className="px-1.5 py-0.5 rounded hover:bg-zinc-800 hover:text-white">100%</button>
          </div>

          <div className="w-px h-3.5 bg-zinc-800" />

          <button
            onClick={handleDeleteSelectedImage}
            className="p-1 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
            title="Delete Image"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-2 border-b border-zinc-900 bg-zinc-950/60">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive("highlight")} title="Highlight">
          <Highlighter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-zinc-800 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Quote">
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} title="Inline code">
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={handleImageButtonClick} title="Insert / Paste image">
          <ImagePlus className="h-3.5 w-3.5" />
        </ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
        <div className="w-px h-4 bg-zinc-800 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>

        {/* Heading shortcuts */}
        <div className="w-px h-4 bg-zinc-800 mx-1" />
        {[1, 2, 3].map((level) => (
          <ToolbarButton
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
            isActive={editor.isActive("heading", { level })}
            title={`Heading ${level}`}
          >
            <span className="text-[10px] font-bold">H{level}</span>
          </ToolbarButton>
        ))}
      </div>

      {/* Editor Content */}
      <div className="flex-1 min-h-[300px] cursor-text" onClick={handleEditorClick}>
        <EditorContent editor={editor} className="h-full" />
      </div>

      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #52525b;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; color: #f4f4f5; margin: 0.75rem 0 0.25rem; }
        .ProseMirror h2 { font-size: 1.2rem; font-weight: 700; color: #e4e4e7; margin: 0.75rem 0 0.25rem; }
        .ProseMirror h3 { font-size: 1rem; font-weight: 600; color: #d4d4d8; margin: 0.75rem 0 0.25rem; }
        .ProseMirror ul { list-style: disc; padding-left: 1.25rem; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.25rem; }
        .ProseMirror li { margin: 0.15rem 0; }
        .ProseMirror blockquote { border-left: 3px solid #3f3f46; padding-left: 1rem; color: #71717a; margin: 0.5rem 0; }
        .ProseMirror code { background: #18181b; border: 1px solid #3f3f46; border-radius: 4px; padding: 1px 5px; font-size: 0.8em; color: #a78bfa; }
        .ProseMirror mark { background: rgba(234, 179, 8, 0.25); border-radius: 2px; color: #fde047; padding: 0 2px; }
        .ProseMirror strong { font-weight: 700; color: #e4e4e7; }
        .ProseMirror em { font-style: italic; color: #a1a1aa; }
        .ProseMirror s { text-decoration: line-through; color: #71717a; }
        .ProseMirror p { margin: 0.25rem 0; }
        .ProseMirror img { border-radius: 0.5rem; margin: 0.5rem 0; max-width: 100%; height: auto; transition: all 0.15s ease; }
      `}</style>
    </div>
  );
}

