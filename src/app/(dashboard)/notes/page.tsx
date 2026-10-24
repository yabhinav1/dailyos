"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  getNotesAction, getFoldersAction, createNote, updateNote, deleteNote,
  restoreNote, toggleNotePin, toggleNoteFavorite, createFolder, deleteFolder,
  getNoteVersionAction, getNoteAction, restoreNoteRevisionAction,
} from "@/features/notes/actions";
import ShareDialog from "@/components/share/share-dialog";
import {
  getShareSettingsAction,
  inviteToNoteAction,
  removeNoteShareAction,
  resetShareLinkAction,
  setLinkAccessAction,
} from "@/features/notes/share-actions";
import NotesFolderNav from "@/features/notes/components/notes-folder-nav";
import NoteItem from "@/features/notes/components/note-item";
import ExportMenu from "@/features/notes/components/export-menu";
import RevisionHistoryDialog from "@/features/notes/components/revision-history-dialog";
import { toast } from "@/stores/toast-store";
import {
  FileText,
  Plus,
  Search,
  Pin,
  Star,
  Trash2,
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
  History,
  Share2,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Loader } from "@/components/ui/loader";
import type { Note, NoteFolder } from "@/lib/types";
import { useConfirm } from "@/components/ui/confirm-dialog";

// Dynamically import the editor (avoid SSR issues with Tiptap)
const RichEditor = dynamic(() => import("@/features/notes/components/rich-editor"), { ssr: false });
const DoodleCanvas = dynamic(() => import("@/components/doodle/doodle-canvas"), { ssr: false });
const FreeformCanvas = dynamic(() => import("@/components/notes/freeform-canvas"), { ssr: false });


export default function NotesPage() {
  const confirm = useConfirm();
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panelHidden, setPanelHidden] = useState(false);
  const [notesListCollapsed, setNotesListCollapsed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
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

  // /notes?note=<id> (from search) opens that note once the list has it. A
  // new id while already on this page triggers a reload to pick it up.
  const requestedNoteId = useSearchParams().get("note");
  const pendingNoteIdRef = useRef<string | null>(null);
  const [seenNoteParam, setSeenNoteParam] = useState<string | null>(null);
  if (requestedNoteId !== seenNoteParam) {
    setSeenNoteParam(requestedNoteId);
    if (requestedNoteId) {
      setSelectedFolderId(undefined);
      setSearch("");
      setReloadToken((n) => n + 1);
    }
  }
  useEffect(() => {
    pendingNoteIdRef.current = requestedNoteId;
  }, [requestedNoteId]);
  // The loader runs from an effect, so it reaches the latest handler via a ref.
  const handleSelectNoteRef = useRef<(note: Note) => void>(() => {});

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
      if (notesRes.success && notesRes.data) {
        setNotes(notesRes.data);
        // /notes?note=<id> (from search) opens that note once it has loaded.
        const wanted = pendingNoteIdRef.current;
        const match = wanted ? notesRes.data.find((n) => n.id === wanted) : undefined;
        if (match) {
          pendingNoteIdRef.current = null;
          handleSelectNoteRef.current(match);
        }
      }
      if (foldersRes.success && foldersRes.data) setFolders(foldersRes.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [search, selectedFolderId, reloadToken]);

  // --- Shared notes: version tracking -------------------------------------
  // Each note's last known server version. Saves to a shared note are sent
  // against it, so a collaborator's edit is never silently overwritten.
  const versionsRef = useRef(new Map<string, string>());
  const sharedRef = useRef(false);
  const dirtyRef = useRef(false);
  const [isShared, setIsShared] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [lastEditedBy, setLastEditedBy] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    noteId: string;
    latest: { title: string; content: string | null; doodleData: string | null; canvasData: string | null; updatedAt: Date | string; lastEditedBy: string | null };
  } | null>(null);
  const markShared = (shared: boolean) => {
    sharedRef.current = shared;
    setIsShared(shared);
  };

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
      dirtyRef.current = true;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        saveTimeoutRef.current = null;
        setSaving(true);
        const base = sharedRef.current ? versionsRef.current.get(noteId) : undefined;
        const res = await updateNote(noteId, patch, base);
        setSaving(false);
        if (res.success && res.data) {
          versionsRef.current.set(noteId, new Date(res.data.updatedAt).toISOString());
          dirtyRef.current = false;
        } else if ("conflict" in res && res.conflict && res.data) {
          setConflict({ noteId, latest: res.data });
        }
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
    versionsRef.current.set(note.id, new Date(note.updatedAt).toISOString());
    dirtyRef.current = false;
    markShared(note.linkAccess !== "NONE" || note._count.shares > 0);
    setLastEditedBy(note.lastEditedBy);
    setConflict(null);
  };

  // Loads a newer server version into the editor without counting as an edit.
  const applyRemote = useCallback((noteId: string, latest: NonNullable<typeof conflict>["latest"]) => {
    setEditorTitle(latest.title);
    setEditorContent(latest.content || "");
    setEditorDoodle(latest.doodleData || null);
    setEditorCanvas(latest.canvasData || null);
    setLastEditedBy(latest.lastEditedBy);
    versionsRef.current.set(noteId, new Date(latest.updatedAt).toISOString());
    dirtyRef.current = false;
  }, []);

  // While a shared note is open, pick up collaborators' saves every few
  // seconds. Skipped while there are unsaved local edits: those go up first,
  // and a clash surfaces as a conflict instead of being overwritten.
  const selectedNoteId = selectedNote?.id;
  useEffect(() => {
    if (!selectedNoteId || !isShared) return;
    let stopped = false;
    const timer = setInterval(async () => {
      if (dirtyRef.current || saveTimeoutRef.current || document.hidden) return;
      const v = await getNoteVersionAction(selectedNoteId);
      if (stopped || !v.success || !v.data) return;
      if (v.data.updatedAt === versionsRef.current.get(selectedNoteId)) return;
      const full = await getNoteAction(selectedNoteId);
      if (stopped || !full.success || !full.data || dirtyRef.current) return;
      applyRemote(selectedNoteId, full.data);
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [selectedNoteId, isShared, applyRemote]);

  const resolveConflict = async (keep: "mine" | "theirs") => {
    if (!conflict) return;
    const { noteId, latest } = conflict;
    setConflict(null);
    if (keep === "theirs") {
      applyRemote(noteId, latest);
      return;
    }
    const res = await updateNote(noteId, currentPatch(), new Date(latest.updatedAt).toISOString());
    if (res.success && res.data) {
      versionsRef.current.set(noteId, new Date(res.data.updatedAt).toISOString());
      dirtyRef.current = false;
      reloadAll();
    } else if ("conflict" in res && res.conflict && res.data) {
      setConflict({ noteId, latest: res.data });
    } else {
      toast.error("Couldn't save your version.");
    }
  };
  useEffect(() => {
    handleSelectNoteRef.current = handleSelectNote;
  });

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
      handleSelectNote({ ...note.data, _count: { shares: 0 } });
    } else {
      setError(note.message || "Couldn't create the note. Please try again.");
    }
  };

  // Deletes are soft (deletedAt), so instead of asking permission first the
  // note goes immediately and an Undo rides on the toast. Faster for the
  // common case, and a change of heart still has a road back — which a
  // confirmed hard delete never gave.
  const handleDeleteNote = async (noteId: string) => {
    const removed = notes.find((n) => n.id === noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    if (selectedNote?.id === noteId) setSelectedNote(null);

    const res = await deleteNote(noteId);
    if (!res.success) {
      reloadAll();
      toast.error(res.message || "Couldn't delete the note.");
      return;
    }
    toast.success(`"${removed?.title || "Note"}" deleted.`, {
      label: "Undo",
      onClick: async () => {
        const restored = await restoreNote(noteId);
        if (restored.success) reloadAll();
        else toast.error("Couldn't bring it back.");
      },
    });
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

  const handleCreateFolder = async (name: string) => {
    setError(null);
    const res = await createFolder({ name });
    if (!res.success) {
      setError(res.message || "Couldn't create the folder. Please try again.");
      return false;
    }
    reloadAll();
    return true;
  };

  const handleDeleteFolder = async (folderId: string, name: string) => {
    const ok = await confirm({
      title: `Delete folder "${name}"?`,
      body: "Notes inside are kept and move to All Notes.",
      confirmLabel: "Delete folder",
      destructive: true,
    });
    if (!ok) return;
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
          <NotesFolderNav
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            allTags={allTags}
            folders={folders}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
          />

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
                        {pinnedNotes.map((note) => <NoteItem key={note.id} note={note} selected={selectedNote?.id === note.id} onSelect={handleSelectNote} onPin={handlePinToggle} onDelete={handleDeleteNote} />)}
                        <div className="my-1 border-t border-zinc-200 dark:border-zinc-900" />
                      </>
                    )}
                    {unpinnedNotes.map((note) => (
                      <NoteItem key={note.id} note={note} selected={selectedNote?.id === note.id} onSelect={handleSelectNote} onPin={handlePinToggle} onDelete={handleDeleteNote} />
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
              {/* Share */}
              <button
                onClick={() => setShareOpen(true)}
                title="Share this note"
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors shrink-0 ${
                  isShared
                    ? "border-blue-500/40 bg-blue-500/10 text-blue-300 hover:text-blue-200"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:text-white hover:border-zinc-700"
                }`}
              >
                {isShared ? <Users className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isShared ? "Shared" : "Share"}</span>
              </button>
              <ExportMenu title={editorTitle} html={editorContent} />

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
                {saving ? "Saving..." : isShared && lastEditedBy ? `Saved · last edit by ${lastEditedBy}` : "Auto-saved"}
              </span>
            </div>

            {conflict && conflict.noteId === selectedNote.id && (
              <div role="alert" className="mx-6 mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="flex-1 min-w-[200px]">
                  {conflict.latest.lastEditedBy || "Someone"} changed this note while you were editing. Your latest changes aren&apos;t saved yet.
                </span>
                <button onClick={() => resolveConflict("theirs")} className="rounded-md px-2.5 py-1 font-semibold hover:bg-amber-500/10">
                  Use their version
                </button>
                <button onClick={() => resolveConflict("mine")} className="rounded-md bg-amber-500/20 px-2.5 py-1 font-semibold hover:bg-amber-500/30">
                  Keep mine
                </button>
              </div>
            )}

            <ShareDialog
              kind="note"
              itemKey={selectedNote.id}
              title={editorTitle}
              api={{
                load: () => getShareSettingsAction(selectedNote.id),
                setLinkAccess: (access) => setLinkAccessAction(selectedNote.id, access),
                invite: (email, role) => inviteToNoteAction(selectedNote.id, email, role),
                remove: (shareId) => removeNoteShareAction(shareId),
                reset: () => resetShareLinkAction(selectedNote.id),
              }}
              open={shareOpen}
              onOpenChange={setShareOpen}
              onSharingChange={(shared) => {
                markShared(shared);
                reloadAll();
              }}
            />

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
                    <RichEditor content={editorContent} onChange={handleContentChange} placeholder="Start writing your note..." mediaTarget={{ noteId: selectedNote.id }} />
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
                  onClick={() => setShowHistoryDrawer(true)}
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
            <RevisionHistoryDialog
              open={showHistoryDrawer}
              noteId={selectedNote.id}
              onClose={() => setShowHistoryDrawer(false)}
              onRestore={async (revisionId) => {
                // A pending autosave would write over the restored version.
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
                const res = await restoreNoteRevisionAction(revisionId);
                if (!res.success || !res.data) {
                  toast.error(res.message || "Couldn't restore that version.");
                  return;
                }
                applyRemote(selectedNote.id, res.data);
                setShowHistoryDrawer(false);
                toast.success("Version restored. The one it replaced is in history too.");
                reloadAll();
              }}
            />
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

