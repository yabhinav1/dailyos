"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AlertCircle, Eye, GitBranch, Pencil } from "lucide-react";
import { getSharedNoteAction, saveSharedNoteAction } from "@/features/notes/share-actions";
import { toast } from "@/stores/toast-store";

const RichEditor = dynamic(() => import("@/features/notes/components/rich-editor"), { ssr: false });

type SharedNote = NonNullable<Awaited<ReturnType<typeof getSharedNoteAction>>["data"]>;
type Snapshot = { title: string; content: string; updatedAt: string; lastEditedBy: string | null };

const POLL_MS = 3000;
const SAVE_DELAY_MS = 800;

/**
 * A note opened through its share link. Editors' changes save a moment after
 * they stop typing; everyone's view refreshes every few seconds. A save only
 * lands on top of the version it was based on, so two people editing at once
 * get a conflict prompt instead of one silently erasing the other.
 */
export default function SharedNoteEditor({
  token,
  initial,
  signedIn,
}: {
  token: string;
  initial: SharedNote;
  signedIn: boolean;
}) {
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [role, setRole] = useState(initial.role);
  const [lastEditedBy, setLastEditedBy] = useState(initial.lastEditedBy);
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved" | "offline">("saved");
  const [conflict, setConflict] = useState<Snapshot | null>(null);
  const [lostAccess, setLostAccess] = useState(false);

  const baseRef = useRef(initial.updatedAt);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ title: initial.title, content: initial.content });
  // Read from timers, so a ref rather than the state's stale closure.
  const conflictRef = useRef(false);

  const canEdit = role === "EDIT" || role === "OWNER";

  const applyRemote = useCallback((s: Snapshot) => {
    setTitle(s.title);
    setContent(s.content);
    setLastEditedBy(s.lastEditedBy);
    latestRef.current = { title: s.title, content: s.content };
    baseRef.current = s.updatedAt;
    dirtyRef.current = false;
    setStatus("saved");
  }, []);

  const save = useCallback(
    async (base: string) => {
      setStatus("saving");
      const res = await saveSharedNoteAction(token, latestRef.current, base);
      if (res.success) {
        baseRef.current = res.latest.updatedAt;
        setLastEditedBy(res.latest.lastEditedBy);
        // Typing may have continued while the save was in flight.
        if (latestRef.current.title === res.latest.title && latestRef.current.content === res.latest.content) {
          dirtyRef.current = false;
          setStatus("saved");
        }
        return;
      }
      if (res.conflict) {
        conflictRef.current = true;
        setConflict(res.latest);
        setStatus("unsaved");
        return;
      }
      setStatus("unsaved");
      toast.error(res.message || "Couldn't save your changes.");
    },
    [token]
  );

  const scheduleSave = () => {
    dirtyRef.current = true;
    setStatus("unsaved");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!conflictRef.current) save(baseRef.current);
    }, SAVE_DELAY_MS);
  };

  const onTitle = (value: string) => {
    setTitle(value);
    latestRef.current = { ...latestRef.current, title: value };
    scheduleSave();
  };
  const onContent = (value: string) => {
    setContent(value);
    latestRef.current = { ...latestRef.current, content: value };
    scheduleSave();
  };

  // Pick up other people's saves; also notices a role change or revoked access.
  useEffect(() => {
    let stopped = false;
    const timer = setInterval(async () => {
      if (document.hidden || dirtyRef.current || timerRef.current) return;
      const res = await getSharedNoteAction(token);
      if (stopped) return;
      if (!res.success || !res.data) {
        if (res.status === "not-found" || res.status === "no-access" || res.status === "sign-in") setLostAccess(true);
        return;
      }
      setRole(res.data.role);
      if (res.data.updatedAt !== baseRef.current && !dirtyRef.current) applyRemote(res.data);
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [token, applyRemote]);

  // Unsaved edits on the way out: send them, and warn if they can't be.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const resolve = async (keep: "mine" | "theirs") => {
    if (!conflict) return;
    const theirs = conflict;
    conflictRef.current = false;
    setConflict(null);
    if (keep === "theirs") applyRemote(theirs);
    else await save(theirs.updatedAt);
  };

  if (lostAccess) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#0d0d0d] px-4 text-center text-zinc-300">
        <div className="space-y-2">
          <h1 className="text-lg font-bold text-white">This note is no longer shared with you</h1>
          <p className="text-sm text-zinc-400">The owner changed its sharing or removed it.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-zinc-200">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-900 bg-[#0d0d0d]/95 px-4 py-2.5 backdrop-blur sm:px-8">
        <Link href={signedIn ? "/today" : "/"} className="flex items-center gap-2 text-sm font-bold text-white shrink-0" aria-label="DailyOS home">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-500">
            <GitBranch className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">DailyOS</span>
        </Link>
        <div className="min-w-0 flex-1 text-xs text-zinc-400 truncate">
          Shared by <span className="text-zinc-200">{initial.owner}</span>
        </div>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0 ${
            canEdit ? "bg-blue-500/15 text-blue-300" : "bg-zinc-800 text-zinc-300"
          }`}
        >
          {canEdit ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {canEdit ? "Can edit" : "View only"}
        </span>
        {!signedIn && (
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/s/${token}`)}`} className="text-xs text-blue-400 hover:text-blue-300 shrink-0">
            Sign in
          </Link>
        )}
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 space-y-3">
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          readOnly={!canEdit}
          aria-label="Note title"
          placeholder="Untitled note"
          className="w-full bg-transparent text-2xl font-bold text-white placeholder-zinc-600 outline-none"
        />
        <p className="text-[11px] text-zinc-500" aria-live="polite">
          {status === "saving"
            ? "Saving…"
            : status === "unsaved"
              ? "Unsaved changes"
              : lastEditedBy
                ? `All changes saved · last edit by ${lastEditedBy}`
                : "All changes saved"}
        </p>

        {conflict && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1 min-w-[200px]">
              {conflict.lastEditedBy || "Someone"} changed this note while you were editing. Your latest changes aren&apos;t saved yet.
            </span>
            <button onClick={() => resolve("theirs")} className="rounded-md px-2.5 py-1 font-semibold hover:bg-amber-500/10">
              Use their version
            </button>
            <button onClick={() => resolve("mine")} className="rounded-md bg-amber-500/20 px-2.5 py-1 font-semibold hover:bg-amber-500/30">
              Keep mine
            </button>
          </div>
        )}

        <RichEditor
          content={content}
          onChange={onContent}
          editable={canEdit}
          aiTools={signedIn}
          placeholder={canEdit ? "Start writing…" : ""}
        />
      </div>
    </main>
  );
}
