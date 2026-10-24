"use client";

import React, { useState } from "react";
import { Download } from "lucide-react";

type Format = "md" | "html" | "txt" | "pdf";

/** Downloads the open note as Markdown, HTML or text, or prints it to PDF. */
export default function ExportMenu({ title, html }: { title: string; html: string }) {
  const [open, setOpen] = useState(false);

  const exportAs = (format: Format) => {
    setOpen(false);
    if (format === "pdf") {
      window.print();
      return;
    }
    const cleanTitle = title || "Untitled Note";
    const cleanText = (html || "").replace(/<[^>]*>/g, " ").trim();
    let fileContent = "";
    let mimeType = "text/plain";
    let ext = "txt";
    if (format === "md") {
      fileContent = `# ${cleanTitle}\n\n${cleanText}`;
      mimeType = "text/markdown";
      ext = "md";
    } else if (format === "html") {
      fileContent = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${cleanTitle}</title><style>body{font-family:sans-serif;line-height:1.6;padding:40px;max-width:800px;margin:0 auto;color:#e4e4e7;background:#0d0d0d;}</style></head><body><h1>${cleanTitle}</h1>${html}</body></html>`;
      mimeType = "text/html";
      ext = "html";
    } else {
      fileContent = `${cleanTitle}\n\n${cleanText}`;
    }
    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cleanTitle.toLowerCase().replace(/\s+/g, "_")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const item = "w-full text-left px-2 py-1.5 rounded hover:bg-zinc-900 text-zinc-200 hover:text-white transition-colors text-xs";

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        title="Export Note"
        className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Export</span>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl space-y-1 text-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1 text-[11px] uppercase font-bold text-zinc-400 tracking-wider border-b border-zinc-900 mb-1">
            Export Note As
          </div>
          <button onClick={() => exportAs("md")} className={item}>📄 Markdown (.md)</button>
          <button onClick={() => exportAs("html")} className={item}>🌐 HTML Document (.html)</button>
          <button onClick={() => exportAs("txt")} className={item}>📝 Plain Text (.txt)</button>
          <button onClick={() => exportAs("pdf")} className={`${item} border-t border-zinc-900 mt-1 pt-1`}>
            🖨️ Print / Save to PDF
          </button>
        </div>
      )}
    </div>
  );
}
