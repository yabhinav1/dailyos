"use client";

import React, { useState } from "react";
import { ChevronDown, FileText, FolderOpen, FolderPlus, Hash, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { NoteFolder } from "@/lib/types";
import SharedWithMe from "./shared-with-me";

interface NotesFolderNavProps {
  /** undefined = all notes, null = uncategorized, string = a folder. */
  selectedFolderId: string | null | undefined;
  onSelectFolder: (folderId: string | null | undefined) => void;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  allTags: string[];
  folders: NoteFolder[];
  /** Resolves true once the folder exists, so the input can clear. */
  onCreateFolder: (name: string) => Promise<boolean>;
  onDeleteFolder: (folderId: string, name: string) => void;
}

/** The notes sidebar's filters: all/uncategorized, shared, hashtags, folders. */
export default function NotesFolderNav({
  selectedFolderId,
  onSelectFolder,
  selectedTag,
  onSelectTag,
  allTags,
  folders,
  onCreateFolder,
  onDeleteFolder,
}: NotesFolderNavProps) {
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (await onCreateFolder(name)) {
      setNewFolderName("");
      setShowNewFolder(false);
    }
  };

  return (
    <div className="p-2 space-y-0.5">
      <button
        onClick={() => { onSelectFolder(undefined); onSelectTag(null); }}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
          selectedFolderId === undefined && !selectedTag ? "bg-zinc-900 text-white" : "text-zinc-300 hover:bg-zinc-900/60 hover:text-zinc-200"
        }`}
      >
        <FileText className="h-3.5 w-3.5" /> All Notes
      </button>
      <button
        onClick={() => onSelectFolder(null)}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
          selectedFolderId === null ? "bg-zinc-900 text-white" : "text-zinc-300 hover:bg-zinc-900/60 hover:text-zinc-200"
        }`}
      >
        <FileText className="h-3.5 w-3.5 text-zinc-400" /> Uncategorized
      </button>
      <SharedWithMe />
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
                onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
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
            aria-label="New folder"
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
                  onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
                  className="h-7 text-xs bg-zinc-900 border-zinc-800 text-white placeholder-zinc-400"
                />
                <button onClick={createFolder} aria-label="Create folder" className="text-indigo-400 hover:text-indigo-300 p-1">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {folders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => onSelectFolder(folder.id)}
                className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  selectedFolderId === folder.id ? "bg-zinc-900 text-white" : "text-zinc-300 hover:bg-zinc-900/50 hover:text-zinc-200"
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{folder.name}</span>
                <span className="text-[11px] text-zinc-400">{folder._count?.notes}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id, folder.name); }}
                  aria-label={`Delete folder ${folder.name}`}
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
  );
}
