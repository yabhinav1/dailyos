"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  getNotesAction, getFoldersAction, createNote, updateNote, deleteNote,
  toggleNotePin, toggleNoteFavorite, createFolder, deleteFolder,
} from "@/features/notes/actions";
import {
  FileText,
  FolderOpen,
  Plus,
  Search,
  Pin,
  Star,
  Trash2,
  FolderPlus,
  X,
  PenTool,
  Type,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  AlertCircle,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Download,
  History,
  Hash,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";
import { Loader } from "@/components/ui/loader";
import type { Note, NoteFolder } from "@/lib/types";

// Dynamically import the editor (avoid SSR issues with Tiptap)
const RichEditor = dynamic(() => import("@/features/notes/components/rich-editor"), { ssr: false });
const DoodleCanvas = dynamic(() => import("@/components/doodle/doodle-canvas"), { ssr: false });
const FreeformCanvas = dynamic(() => import("@/components/notes/freeform-canvas"), { ssr: false });


export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [panelHidden, setPanelHidden] = useState(false);
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [notesListCollapsed, setNotesListCollapsed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Array<{ id: string; time: string; title: string; content: string; doodle: string | null }>>([]);
  const [error, setError] = useState<string | null>(null);

  // Editor state (local buffer while editing)
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorDoodle, setEditorDoodle] = useState<string | null>(null);
  const [editorCanvas, setEditorCanvas] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"write" | "doodle" | "canvas">("write");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Extract all hashtags across all notes
  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => {
      const text = `${n.title || ""} ${n.content || ""}`.replace(/<[^>]*>/g, " ");
      const matches = text.match(/#[\w-]+/g);
      if (matches) matches.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [notes]);
  // Calculate live note statistics
  const cleanText = (editorContent || "").replace(/<[^>]*>/g, " ").trim();
  const wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
  const charCount = cleanText.length;
  const readTimeMins = Math.max(1, Math.ceil(wordCount / 200));
  const handleExportNote = (format: "md" | "html" | "txt" | "pdf") => {
    if (!selectedNote) return;
    const cleanTitle = editorTitle || "Untitled Note";
    if (format === "pdf") {
      window.print();
      setShowExportMenu(false);
      return;
    }
    let fileContent = "";
    let mimeType = "text/plain";
    let ext = "txt";
    if (format === "md") {
      fileContent = `# ${cleanTitle}\n\n${cleanText}`;
      mimeType = "text/markdown";
      ext = "md";
    } else if (format === "html") {
      fileContent = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${cleanTitle}</title><style>body{font-family:sans-serif;line-height:1.6;padding:40px;max-width:800px;margin:0 auto;color:#e4e4e7;background:#0d0d0d;}</style></head><body><h1>${cleanTitle}</h1>${editorContent}</body></html>`;
      mimeType = "text/html";
      ext = "html";
    } else {
      fileContent = `${cleanTitle}\n\n${cleanText}`;
      mimeType = "text/plain";
      ext = "txt";
    }
    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cleanTitle.toLowerCase().replace(/\s+/g, "_")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // Esc key listener to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  const [reloadToken, setReloadToken] = useState(0);
  const reloadAll = useCallback(() => setReloadToken((n) => n + 1), []);

  // Search text and folder both change while requests are in flight, so a
  // superseded response is discarded instead of clobbering the newer one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [notesRes, foldersRes] = await Promise.all([
        getNotesAction(search || undefined, selectedFolderId),
        getFoldersAction(),
      ]);
      if (cancelled) return;
      if (notesRes.success && notesRes.data) setNotes(notesRes.data);
      if (foldersRes.success && foldersRes.data) setFolders(foldersRes.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [search, selectedFolderId, reloadToken]);

  // Auto-save after 1s of inactivity
  const triggerAutoSave = useCallback(
    (
      noteId: string,
      patch: {
        title: string;
        content: string;
        doodleData: string | null;
        canvasData: string | null;
      }
    ) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        await updateNote(noteId, patch);
        setSaving(false);
        reloadAll();
      }, 1000);
    },
    [reloadAll]
  );
  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setEditorTitle(note.title);
    setEditorContent(note.content || "");
    setEditorDoodle(note.doodleData || null);
    setEditorCanvas(note.canvasData || null);
    setViewMode("write");
  };

  // Each handler sends the whole note, with only its own field replaced, so a
  // save started from one editor mode can never blank out another's work.
  const currentPatch = () => ({
    title: editorTitle,
    content: editorContent,
    doodleData: editorDoodle,
    canvasData: editorCanvas,
  });

  const handleTitleChange = (val: string) => {
    setEditorTitle(val);
    if (selectedNote) triggerAutoSave(selectedNote.id, { ...currentPatch(), title: val });
  };

  const handleCanvasChange = (val: string) => {
    setEditorCanvas(val);
    if (selectedNote) triggerAutoSave(selectedNote.id, { ...currentPatch(), canvasData: val });
  };

  const handleContentChange = (val: string) => {
    setEditorContent(val);
    if (selectedNote) triggerAutoSave(selectedNote.id, { ...currentPatch(), content: val });
  };

  const handleDoodleChange = (val: string) => {
    setEditorDoodle(val);
    if (selectedNote) triggerAutoSave(selectedNote.id, { ...currentPatch(), doodleData: val });
  };

  const handleCreateNote = async () => {
    setError(null);
    const note = await createNote({
      title: "Untitled Note",
      content: "",
      folderId: selectedFolderId ?? null,
    });
    if (note.success && note.data) {
      reloadAll();
      handleSelectNote(note.data);
    } else {
      setError(note.message || "Couldn't create the note. Please try again.");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Move this note to trash?")) return;
    await deleteNote(noteId);
    if (selectedNote?.id === noteId) setSelectedNote(null);
    reloadAll();
  };
  const handlePinToggle = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleNotePin(note.id, !note.isPinned);
    reloadAll();
  };
  const handleFavoriteToggle = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleNoteFavorite(note.id, !note.isFavorite);
    reloadAll();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setError(null);
    const res = await createFolder({ name: newFolderName.trim() });
    if (!res.success) {
      setError(res.message || "Couldn't create the folder. Please try again.");
      return;
    }
    setNewFolderName("");
    setShowNewFolder(false);
    reloadAll();
  };

  const handleDeleteFolder = async (folderId: string, name: string) => {
    if (!confirm(`Delete folder "${name}"? Notes inside will be moved to All Notes.`)) return;
    await deleteFolder(folderId);
    if (selectedFolderId === folderId) setSelectedFolderId(undefined);
    reloadAll();
  };
  const tagFilteredNotes = selectedTag
    ? notes.filter((n) => `${n.title || ""} ${n.content || ""}`.includes(selectedTag))
    : notes;
  const pinnedNotes = tagFilteredNotes.filter((n) => n.isPinned);
  const unpinnedNotes = tagFilteredNotes.filter((n) => !n.isPinned);

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 -mx-6 -mt-6 overflow-hidden">
      {/* ── LEFT SIDEBAR: Folders + Notes List ── */}
      <div
        className={`flex flex-col border-r border-zinc-200 dark:border-zinc-900 bg-white dark:bg-[#171717] shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          panelHidden ? "w-0 border-r-0 opacity-0 pointer-events-none" : "w-64 opacity-100"
        }`}
      >
        {/* Sidebar Header with Hide/Collapse Toggle */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/40">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Notes Sidebar
          </span>
          <button
            onClick={() => setPanelHidden(true)}
            title="Hide notes sidebar"
            className="p-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1 text-[11px]"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
            <span>Hide</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-900">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 bg-zinc-100 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-400"
            />
          </div>
        </div>

        {error && (
          <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400/70 hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {/* Folder & Hashtag Sidebar */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-0.5">
            <button
              onClick={() => { setSelectedFolderId(undefined); setSelectedTag(null); }}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                selectedFolderId === undefined && !selectedTag ? "bg-zinc-900 text-white" : "text-zinc-300 hover:bg-zinc-900/60 hover:text-zinc-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> All Notes
            </button>
            <button
              onClick={() => setSelectedFolderId(null)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                selectedFolderId === null ? "bg-zinc-900 text-white" : "text-zinc-300 hover:bg-zinc-900/60 hover:text-zinc-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-zinc-400" /> Uncategorized
            </button>
            {/* Smart Hashtags */}
            {allTags.length > 0 && (
              <div className="pt-2 pb-1">
                <div className="px-2.5 mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Hashtags
                </div>
                <div className="flex flex-wrap gap-1 px-2">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors ${
                        selectedTag === tag
                          ? "bg-zinc-100 text-zinc-950 font-bold"
                          : "bg-zinc-900/80 text-zinc-300 hover:text-zinc-200 border border-zinc-800"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <div className="flex items-center justify-between px-2.5 mb-1">
                <button
                  onClick={() => setFoldersCollapsed((v) => !v)}
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${foldersCollapsed ? "-rotate-90" : ""}`} />
                  Folders
                </button>
                <button
                  onClick={() => setShowNewFolder(!showNewFolder)}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Collapses upward (grid-rows trick keeps the height animation smooth) */}
              <div
                className={`grid transition-all duration-200 ease-in-out ${
                  foldersCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                }`}
              >
                <div className="overflow-hidden">
                  {showNewFolder && (
                    <div className="flex items-center gap-1 px-1 mb-1">
                      <Input
                        autoFocus
                        placeholder="Folder name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
                        className="h-7 text-xs bg-zinc-900 border-zinc-800 text-white placeholder-zinc-400"
                      />
                      <button onClick={handleCreateFolder} aria-label="Create folder" className="text-indigo-400 hover:text-indigo-300 p-1">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedFolderId(folder.id)}
                      className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        selectedFolderId === folder.id ? "bg-zinc-900 text-white" : "text-zinc-300 hover:bg-zinc-900/50 hover:text-zinc-200"
                      }`}
                    >
                      <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 truncate">{folder.name}</span>
                      <span className="text-[11px] text-zinc-400">{folder._count?.notes}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id, folder.name); }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-400 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Note List */}
          <div className="border-t border-zinc-200 dark:border-zinc-900 mt-2 pt-2 px-2 space-y-0.5">
            <div className="flex items-center justify-between px-1.5 pb-1">
              <button
                onClick={() => setNotesListCollapsed((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${notesListCollapsed ? "-rotate-90" : ""}`} />
                {notes.length} Notes
              </button>
              <button onClick={handleCreateNote} aria-label="New note" className="text-zinc-400 hover:text-indigo-400 transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Collapses upward/downward (grid-rows trick keeps the height animation smooth) */}
            <div
              className={`grid transition-all duration-200 ease-in-out ${
                notesListCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
              }`}
            >
              <div className="overflow-hidden">
                {loading ? (
                  <div className="py-8 text-center">
                    <Loader />
                  </div>
                ) : (
                  <>
                    {pinnedNotes.length > 0 && (
                      <>
                        <div className="px-1.5 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">📌 Pinned</div>
                        {pinnedNotes.map((note) => <NoteItem key={note.id} note={note} selected={selectedNote?.id === note.id} onSelect={handleSelectNote} onPin={handlePinToggle} onFavorite={handleFavoriteToggle} onDelete={handleDeleteNote} />)}
                        <div className="my-1 border-t border-zinc-200 dark:border-zinc-900" />
                      </>
                    )}
                    {unpinnedNotes.map((note) => (
                      <NoteItem key={note.id} note={note} selected={selectedNote?.id === note.id} onSelect={handleSelectNote} onPin={handlePinToggle} onFavorite={handleFavoriteToggle} onDelete={handleDeleteNote} />
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Create Note Button */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-900">
          <Button onClick={handleCreateNote} size="sm" className="w-full text-xs gap-1.5 h-8 font-semibold">
            <Plus className="h-3.5 w-3.5" /> New Note
          </Button>
        </div>
      </div>

      {/* ── MAIN EDITOR AREA ── */}
      <div
        className={
          isFullScreen
            ? "fixed inset-0 z-[80] flex flex-col bg-[#0d0d0d] p-6 overflow-hidden animate-in fade-in duration-200"
            : "flex-1 flex flex-col bg-white dark:bg-[#0d0d0d] overflow-hidden"
        }
      >
        {selectedNote ? (
          <>
            {/* Title Bar */}
            <div className="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-zinc-200 dark:border-zinc-900 shrink-0">
              {!isFullScreen && (
                <button
                  onClick={() => setPanelHidden((v) => !v)}
                  title={panelHidden ? "Show notes list" : "Hide notes list"}
                  className="text-zinc-400 hover:text-white transition-colors shrink-0"
                >
                  {panelHidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
              )}
              <Input
                value={editorTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Untitled Note"
                className="text-xl font-bold text-zinc-900 dark:text-white border-0 bg-transparent p-0 focus:ring-0 focus:outline-none placeholder-zinc-400 h-auto shadow-none"
              />
              <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5 shrink-0">
                <button
                  onClick={() => setViewMode("write")}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "write" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Type className="h-3 w-3" /> Write
                </button>
                <button
                  onClick={() => setViewMode("doodle")}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "doodle" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <PenTool className="h-3 w-3" /> Doodle
                </button>
                <button
                  onClick={() => setViewMode("canvas")}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "canvas" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <LayoutGrid className="h-3 w-3" /> Canvas
                </button>
              </div>
              {/* Export Dropdown */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  title="Export Note"
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl space-y-1 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2 py-1 text-[11px] uppercase font-bold text-zinc-400 tracking-wider border-b border-zinc-900 mb-1">
                      Export Note As
                    </div>
                    <button
                      onClick={() => handleExportNote("md")}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-900 text-zinc-200 hover:text-white transition-colors text-xs"
                    >
                      📄 Markdown (.md)
                    </button>
                    <button
                      onClick={() => handleExportNote("html")}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-900 text-zinc-200 hover:text-white transition-colors text-xs"
                    >
                      🌐 HTML Document (.html)
                    </button>
                    <button
                      onClick={() => handleExportNote("txt")}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-900 text-zinc-200 hover:text-white transition-colors text-xs"
                    >
                      📝 Plain Text (.txt)
                    </button>
                    <button
                      onClick={() => handleExportNote("pdf")}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-900 text-zinc-200 hover:text-white transition-colors text-xs border-t border-zinc-900 mt-1 pt-1"
                    >
                      🖨️ Print / Save to PDF
                    </button>
                  </div>
                )}
              </div>

              {/* Fullscreen Button */}
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={isFullScreen ? "Exit Fullscreen (Esc)" : "Fullscreen View"}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors shrink-0"
              >
                {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isFullScreen ? "Exit Fullscreen" : "Fullscreen"}</span>
              </button>

              <span className={`text-[11px] font-medium shrink-0 transition-opacity ${saving ? "text-amber-400 opacity-100" : "text-zinc-400 opacity-60"}`}>
                {saving ? "Saving..." : "Auto-saved"}
              </span>
            </div>

            {/* Editor */}
            <div
              className={
                viewMode === "write"
                  ? "flex-1 overflow-y-auto px-6 py-4"
                  : "flex-1 min-h-0 overflow-hidden px-6 py-4 flex"
              }
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={viewMode}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className={viewMode === "write" ? "" : "flex h-full w-full"}
                >
                  {viewMode === "write" ? (
                    <RichEditor content={editorContent} onChange={handleContentChange} placeholder="Start writing your note..." />
                  ) : viewMode === "canvas" ? (
                    <FreeformCanvas value={editorCanvas} onChange={handleCanvasChange} className="h-full" />
                  ) : (
                    <DoodleCanvas value={editorDoodle} onChange={handleDoodleChange} fillContainer className="h-full" />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            {/* Footer Meta & Smart Stats HUD */}
            <div className="px-6 py-2 border-t border-zinc-200 dark:border-zinc-900 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
              <div className="flex items-center gap-3">
                <span>Updated {new Date(selectedNote.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="text-zinc-700">•</span>
                <span className="font-mono text-zinc-300">{wordCount} words</span>
                <span className="text-zinc-700">•</span>
                <span className="font-mono text-zinc-300">{charCount} chars</span>
                <span className="text-zinc-700">•</span>
                <span className="text-zinc-300">{readTimeMins} min read</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Record current snapshot if none exists
                    if (snapshots.length === 0 && selectedNote) {
                      setSnapshots([
                        {
                          id: Date.now().toString(),
                          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                          title: editorTitle,
                          content: editorContent,
                          doodle: editorDoodle,
                        },
                      ]);
                    }
                    setShowHistoryDrawer(!showHistoryDrawer);
                  }}
                  title="View Note Revision History"
                  className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                >
                  <History className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">History</span>
                </button>
                <button onClick={(e) => handlePinToggle(selectedNote, e)} className={`hover:text-white transition-colors ${selectedNote.isPinned ? "text-amber-400" : "text-zinc-400"}`}>
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button onClick={(e) => handleFavoriteToggle(selectedNote, e)} className={`hover:text-white transition-colors ${selectedNote.isFavorite ? "text-amber-400" : "text-zinc-400"}`}>
                  <Star className={`h-3.5 w-3.5 ${selectedNote.isFavorite ? "fill-amber-400" : ""}`} />
                </button>
                <button onClick={() => handleDeleteNote(selectedNote.id)} className="text-zinc-400 hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {/* Revision History Drawer Modal */}
            {showHistoryDrawer && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-[#171717] border border-zinc-800 rounded-xl p-5 max-w-md w-full space-y-3 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <History className="h-4 w-4 text-zinc-300" /> Revision History
                    </h3>
                    <button onClick={() => setShowHistoryDrawer(false)} className="text-zinc-300 hover:text-white p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {snapshots.length === 0 ? (
                      <p className="text-xs text-zinc-400 py-4 text-center">No previous revisions recorded yet. Make edits to create auto-snapshots.</p>
                    ) : (
                      snapshots.map((snap, idx) => (
                        <div key={snap.id} className="p-3 rounded-lg border border-zinc-800 bg-zinc-950 flex items-center justify-between">
                          <div>
                            <div className="text-xs font-semibold text-zinc-200">{snap.title || "Untitled Note"}</div>
                            <div className="text-[11px] text-zinc-400">Snapshot #{idx + 1} • {snap.time}</div>
                          </div>
                          <Button
                            size="xs"
                            onClick={() => {
                              setEditorTitle(snap.title);
                              setEditorContent(snap.content);
                              setEditorDoodle(snap.doodle);
                              setShowHistoryDrawer(false);
                            }}
                            className="text-[11px] h-6 px-2"
                          >
                            Restore
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center relative">
            {panelHidden && (
              <button
                onClick={() => setPanelHidden(false)}
                title="Show notes list"
                className="absolute top-5 left-6 text-zinc-400 hover:text-white transition-colors"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <FileText className="h-12 w-12 text-zinc-800" />
            <p className="text-sm font-semibold text-zinc-400">Select a note to start editing</p>
            <p className="text-xs text-zinc-400">Or create a new one from the sidebar</p>
            <Button onClick={handleCreateNote} size="sm" className="mt-2 text-xs gap-1.5 font-semibold">
              <Plus className="h-3.5 w-3.5" /> New Note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Note Sidebar Item ───────────────────────────────
function NoteItem({ note, selected, onSelect, onPin, onDelete }: {
  note: Note;
  selected: boolean;
  onSelect: (note: Note) => void;
  onPin: (note: Note, e: React.MouseEvent) => void;
  onFavorite: (note: Note, e: React.MouseEvent) => void;
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
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
