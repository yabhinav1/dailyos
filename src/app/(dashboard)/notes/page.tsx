"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  getNotesAction, getFoldersAction, createNote, updateNote, deleteNote,
  toggleNotePin, toggleNoteFavorite, createFolder, deleteFolder,
} from "@/features/notes/actions";
import {
  FileText, FolderOpen, Plus, Search, Pin, Star, Trash2, FolderPlus, X, Save,
  PenTool, Type, PanelLeftClose, PanelLeftOpen, ChevronDown, AlertCircle, Maximize2, Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";
import { Loader } from "@/components/ui/loader";

// Dynamically import the editor (avoid SSR issues with Tiptap)
const RichEditor = dynamic(() => import("@/features/notes/components/rich-editor"), { ssr: false });
const DoodleCanvas = dynamic(() => import("@/components/doodle/doodle-canvas"), { ssr: false });

const NOTE_COLORS = [
  "#1c1c1e", "#1c2a3a", "#1a2d1a", "#2d1a2d", "#2d2d1a", "#2d1a1a",
];

export default function NotesPage() {
  const [notes, setNotes] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedNote, setSelectedNote] = useState<any>(null);
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
  const [error, setError] = useState<string | null>(null);

  // Editor state (local buffer while editing)
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorDoodle, setEditorDoodle] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"write" | "doodle">("write");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [notesRes, foldersRes] = await Promise.all([
      getNotesAction(search || undefined, selectedFolderId),
      getFoldersAction(),
    ]);
    if (notesRes.success && notesRes.data) setNotes(notesRes.data);
    if (foldersRes.success && foldersRes.data) setFolders(foldersRes.data);
    setLoading(false);
  }, [search, selectedFolderId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-save after 1s of inactivity
  const triggerAutoSave = useCallback(
    (noteId: string, title: string, content: string, doodleData: string | null) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        await updateNote(noteId, { title, content, doodleData });
        setSaving(false);
        fetchAll();
      }, 1000);
    },
    [fetchAll]
  );

  const handleSelectNote = (note: any) => {
    setSelectedNote(note);
    setEditorTitle(note.title);
    setEditorContent(note.content || "");
    setEditorDoodle(note.doodleData || null);
    setViewMode("write");
  };

  const handleTitleChange = (val: string) => {
    setEditorTitle(val);
    if (selectedNote) triggerAutoSave(selectedNote.id, val, editorContent, editorDoodle);
  };

  const handleContentChange = (val: string) => {
    setEditorContent(val);
    if (selectedNote) triggerAutoSave(selectedNote.id, editorTitle, val, editorDoodle);
  };

  const handleDoodleChange = (val: string) => {
    setEditorDoodle(val);
    if (selectedNote) triggerAutoSave(selectedNote.id, editorTitle, editorContent, val);
  };

  const handleCreateNote = async () => {
    setError(null);
    const note = await createNote({
      title: "Untitled Note",
      content: "",
      folderId: selectedFolderId ?? null,
    });
    if (note.success && note.data) {
      await fetchAll();
      handleSelectNote(note.data);
    } else {
      setError(note.message || "Couldn't create the note. Please try again.");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Move this note to trash?")) return;
    await deleteNote(noteId);
    if (selectedNote?.id === noteId) setSelectedNote(null);
    fetchAll();
  };

  const handlePinToggle = async (note: any, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleNotePin(note.id, !note.isPinned);
    fetchAll();
  };

  const handleFavoriteToggle = async (note: any, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleNoteFavorite(note.id, !note.isFavorite);
    fetchAll();
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
    fetchAll();
  };

  const handleDeleteFolder = async (folderId: string, name: string) => {
    if (!confirm(`Delete folder "${name}"? Notes inside will be moved to All Notes.`)) return;
    await deleteFolder(folderId);
    if (selectedFolderId === folderId) setSelectedFolderId(undefined);
    fetchAll();
  };

  const pinnedNotes = notes.filter((n) => n.isPinned);
  const unpinnedNotes = notes.filter((n) => !n.isPinned);

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
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Notes Sidebar
          </span>
          <button
            onClick={() => setPanelHidden(true)}
            title="Hide notes sidebar"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1 text-[10px]"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
            <span>Hide</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-900">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <Input
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 bg-zinc-100 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600"
            />
          </div>
        </div>

        {error && (
          <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400/70 hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Folder Sidebar */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-0.5">
            <button
              onClick={() => setSelectedFolderId(undefined)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-colors text-left ${
                selectedFolderId === undefined ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> All Notes
            </button>
            <button
              onClick={() => setSelectedFolderId(null)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-colors text-left ${
                selectedFolderId === null ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-zinc-600" /> Uncategorized
            </button>

            <div className="pt-2">
              <div className="flex items-center justify-between px-2.5 mb-1">
                <button
                  onClick={() => setFoldersCollapsed((v) => !v)}
                  className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${foldersCollapsed ? "-rotate-90" : ""}`} />
                  Folders
                </button>
                <button
                  onClick={() => setShowNewFolder(!showNewFolder)}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors"
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
                        className="h-7 text-[11px] bg-zinc-900 border-zinc-800 text-white placeholder-zinc-600"
                      />
                      <button onClick={handleCreateFolder} className="text-indigo-400 hover:text-indigo-300 p-1">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedFolderId(folder.id)}
                      className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors ${
                        selectedFolderId === folder.id ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                      }`}
                    >
                      <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 truncate">{folder.name}</span>
                      <span className="text-[10px] text-zinc-600">{folder._count?.notes}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id, folder.name); }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition"
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
                className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${notesListCollapsed ? "-rotate-90" : ""}`} />
                {notes.length} Notes
              </button>
              <button onClick={handleCreateNote} className="text-zinc-600 hover:text-indigo-400 transition-colors">
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
                        <div className="px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-600">📌 Pinned</div>
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
                  className="text-zinc-500 hover:text-white transition-colors shrink-0"
                >
                  {panelHidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
              )}
              <Input
                value={editorTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Untitled Note"
                className="text-xl font-bold text-zinc-900 dark:text-white border-0 bg-transparent p-0 focus:ring-0 focus:outline-none placeholder-zinc-600 h-auto shadow-none"
              />
              <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5 shrink-0">
                <button
                  onClick={() => setViewMode("write")}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    viewMode === "write" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Type className="h-3 w-3" /> Write
                </button>
                <button
                  onClick={() => setViewMode("doodle")}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    viewMode === "doodle" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <PenTool className="h-3 w-3" /> Doodle
                </button>
              </div>

              {/* Fullscreen Button */}
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                title={isFullScreen ? "Exit Fullscreen (Esc)" : "Fullscreen View"}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors shrink-0"
              >
                {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isFullScreen ? "Exit Fullscreen" : "Fullscreen"}</span>
              </button>

              <span className={`text-[10px] font-medium shrink-0 transition-opacity ${saving ? "text-amber-400 opacity-100" : "text-zinc-600 opacity-60"}`}>
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
              {viewMode === "write" ? (
                <RichEditor content={editorContent} onChange={handleContentChange} placeholder="Start writing your note..." />
              ) : (
                <DoodleCanvas value={editorDoodle} onChange={handleDoodleChange} fillContainer className="h-full" />
              )}
            </div>

            {/* Footer Meta */}
            <div className="px-6 py-2 border-t border-zinc-200 dark:border-zinc-900 flex items-center justify-between text-[10px] text-zinc-600 shrink-0">
              <span>Last updated {new Date(selectedNote.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <div className="flex items-center gap-2">
                <button onClick={(e) => handlePinToggle(selectedNote, e)} className={`hover:text-white transition-colors ${selectedNote.isPinned ? "text-amber-400" : "text-zinc-600"}`}>
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button onClick={(e) => handleFavoriteToggle(selectedNote, e)} className={`hover:text-white transition-colors ${selectedNote.isFavorite ? "text-amber-400" : "text-zinc-600"}`}>
                  <Star className={`h-3.5 w-3.5 ${selectedNote.isFavorite ? "fill-amber-400" : ""}`} />
                </button>
                <button onClick={() => handleDeleteNote(selectedNote.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center relative">
            {panelHidden && (
              <button
                onClick={() => setPanelHidden(false)}
                title="Show notes list"
                className="absolute top-5 left-6 text-zinc-500 hover:text-white transition-colors"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <FileText className="h-12 w-12 text-zinc-800" />
            <p className="text-sm font-semibold text-zinc-500">Select a note to start editing</p>
            <p className="text-xs text-zinc-600">Or create a new one from the sidebar</p>
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
function NoteItem({ note, selected, onSelect, onPin, onFavorite, onDelete }: {
  note: any;
  selected: boolean;
  onSelect: (note: any) => void;
  onPin: (note: any, e: React.MouseEvent) => void;
  onFavorite: (note: any, e: React.MouseEvent) => void;
  onDelete: (noteId: string) => void;
}) {
  const preview = note.content
    ? note.content.replace(/<[^>]+>/g, "").slice(0, 60)
    : "No content";

  return (
    <div
      onClick={() => onSelect(note)}
      className={`group px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
        selected ? "bg-zinc-800 text-white" : "hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[11px] font-semibold truncate max-w-[120px]">{note.title}</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={(e) => onPin(note, e)} className={`p-0.5 rounded hover:text-white ${note.isPinned ? "text-amber-400" : "text-zinc-600"}`}>
            <Pin className="h-2.5 w-2.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className="p-0.5 rounded text-zinc-600 hover:text-red-400">
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-zinc-600 truncate">{preview}</p>
    </div>
  );
}
