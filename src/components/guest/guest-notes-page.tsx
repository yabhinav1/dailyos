"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLocalNotes, type LocalNote } from "@/lib/local-notes";
import { FileText, Plus, Pin, Trash2, PenTool, Type, LogIn, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const RichEditor = dynamic(() => import("@/features/notes/components/rich-editor"), { ssr: false });
const DoodleCanvas = dynamic(() => import("@/components/doodle/doodle-canvas"), { ssr: false });

export default function GuestNotesPage() {
  const { notes, loaded, storageError, createNote, updateNote, deleteNote, togglePin } = useLocalNotes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorDoodle, setEditorDoodle] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"write" | "doodle">("write");
  const [panelHidden, setPanelHidden] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const selectedNote = notes.find((n) => n.id === selectedId) || null;

  // Auto-select the most recent note once loaded, or create one if none exist
  useEffect(() => {
    if (!loaded) return;
    if (selectedId) return;
    if (notes.length > 0) {
      handleSelectNote(notes[0]);
    } else {
      const note = createNote({ title: "Untitled Note" });
      handleSelectNote(note);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function handleSelectNote(note: LocalNote) {
    setSelectedId(note.id);
    setEditorTitle(note.title);
    setEditorContent(note.content || "");
    setEditorDoodle(note.doodleData || null);
    setViewMode("write");
  }

  const triggerAutoSave = useCallback(
    (id: string, title: string, content: string, doodleData: string | null) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        updateNote(id, { title, content, doodleData });
      }, 500);
    },
    [updateNote]
  );

  const handleTitleChange = (val: string) => {
    setEditorTitle(val);
    if (selectedId) triggerAutoSave(selectedId, val, editorContent, editorDoodle);
  };

  const handleContentChange = (val: string) => {
    setEditorContent(val);
    if (selectedId) triggerAutoSave(selectedId, editorTitle, val, editorDoodle);
  };

  const handleDoodleChange = (val: string) => {
    setEditorDoodle(val);
    if (selectedId) triggerAutoSave(selectedId, editorTitle, editorContent, val);
  };

  const handleCreateNote = () => {
    const note = createNote({ title: "Untitled Note" });
    handleSelectNote(note);
  };

  const handleDeleteNote = (id: string) => {
    if (!confirm("Delete this note? This can't be undone.")) return;
    deleteNote(id);
    if (selectedId === id) {
      const remaining = notes.filter((n) => n.id !== id);
      if (remaining.length > 0) handleSelectNote(remaining[0]);
      else setSelectedId(null);
    }
  };

  const pinned = notes.filter((n) => n.isPinned);
  const unpinned = notes.filter((n) => !n.isPinned);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d0d0d] text-zinc-200">
      {/* Sidebar */}
      <div
        className={`flex flex-col border-r border-zinc-200 dark:border-zinc-900 bg-white dark:bg-[#171717] shrink-0 overflow-hidden transition-all duration-200 ${
          panelHidden ? "w-0 border-r-0" : "w-64"
        }`}
      >
        <div className="flex h-14 items-center px-4 border-b border-zinc-200 dark:border-zinc-900">
          <span className="text-sm font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            DailyOS
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <div className="flex items-center justify-between px-1.5 pb-1 pt-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
              {notes.length} Notes
            </span>
            <button onClick={handleCreateNote} className="text-zinc-600 hover:text-blue-400 transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {pinned.map((note) => (
            <GuestNoteItem
              key={note.id}
              note={note}
              selected={selectedId === note.id}
              onSelect={handleSelectNote}
              onPin={togglePin}
              onDelete={handleDeleteNote}
            />
          ))}
          {pinned.length > 0 && unpinned.length > 0 && (
            <div className="my-1 border-t border-zinc-200 dark:border-zinc-900" />
          )}
          {unpinned.map((note) => (
            <GuestNoteItem
              key={note.id}
              note={note}
              selected={selectedId === note.id}
              onSelect={handleSelectNote}
              onPin={togglePin}
              onDelete={handleDeleteNote}
            />
          ))}
        </div>

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-900 space-y-2">
          <Button onClick={handleCreateNote} size="sm" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" /> New Note
          </Button>
          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 py-2 text-[11px] font-medium text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
          >
            <LogIn className="h-3.5 w-3.5" /> Sign in to save permanently
          </Link>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#0d0d0d] overflow-hidden">
        {selectedNote ? (
          <>
            <div className="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-zinc-200 dark:border-zinc-900 shrink-0">
              <button
                onClick={() => setPanelHidden((v) => !v)}
                title={panelHidden ? "Show notes list" : "Hide notes list"}
                className="text-zinc-500 hover:text-white transition-colors shrink-0"
              >
                {panelHidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
              <input
                value={editorTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Untitled Note"
                className="flex-1 text-xl font-bold text-zinc-900 dark:text-white bg-transparent p-0 focus:outline-none placeholder-zinc-600"
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
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {storageError && (
                <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-400">
                  {storageError}
                </div>
              )}
              {viewMode === "write" ? (
                <RichEditor content={editorContent} onChange={handleContentChange} placeholder="Start writing your note..." />
              ) : (
                <DoodleCanvas value={editorDoodle} onChange={handleDoodleChange} height={420} />
              )}
            </div>

            <div className="px-6 py-2 border-t border-zinc-200 dark:border-zinc-900 flex items-center justify-between text-[10px] text-zinc-600 shrink-0">
              <span>Saved to this browser only</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => togglePin(selectedNote.id)}
                  className={`hover:text-white transition-colors ${selectedNote.isPinned ? "text-amber-400" : "text-zinc-600"}`}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteNote(selectedNote.id)}
                  className="text-zinc-600 hover:text-red-400 transition-colors"
                >
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
          </div>
        )}
      </div>
    </div>
  );
}

function GuestNoteItem({
  note,
  selected,
  onSelect,
  onPin,
  onDelete,
}: {
  note: LocalNote;
  selected: boolean;
  onSelect: (note: LocalNote) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const preview = note.content ? note.content.replace(/<[^>]+>/g, "").slice(0, 60) : "No content";

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
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin(note.id);
            }}
            className={`p-0.5 rounded hover:text-white ${note.isPinned ? "text-amber-400" : "text-zinc-600"}`}
          >
            <Pin className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
            className="p-0.5 rounded text-zinc-600 hover:text-red-400"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-zinc-600 truncate">{preview}</p>
    </div>
  );
}
