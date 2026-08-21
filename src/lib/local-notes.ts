"use client";

import { useCallback, useEffect, useState } from "react";

export interface LocalNote {
  id: string;
  title: string;
  content: string;
  doodleData: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "dailyos_guest_notes";

function readAll(): LocalNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(notes: LocalNote[]): { ok: boolean; error?: string } {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return { ok: true };
  } catch (err) {
    console.error("Failed to save guest notes to localStorage:", err);
    return {
      ok: false,
      error:
        "This browser's storage is full. Delete an old doodle or note, or sign in to save to your account instead.",
    };
  }
}

function genId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Guest-mode notes, persisted to this browser's localStorage.
 * Mirrors the shape of the server-backed notes so the UI can share
 * logic between guest and logged-in experiences where useful.
 */
export function useLocalNotes() {
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // localStorage is unreadable during SSR, so this cannot move into a lazy
  // useState initializer without a hydration mismatch. Reading it once after
  // mount is the intended pattern; the extra render happens a single time.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setNotes(readAll());
    setLoaded(true);
  }, []);

  const persist = useCallback((next: LocalNote[]) => {
    setNotes(next);
    const result = writeAll(next);
    setStorageError(result.ok ? null : result.error || null);
  }, []);

  const createNote = useCallback(
    (partial?: Partial<Pick<LocalNote, "title" | "content" | "doodleData">>) => {
      const now = new Date().toISOString();
      const note: LocalNote = {
        id: genId(),
        title: partial?.title ?? "Untitled Note",
        content: partial?.content ?? "",
        doodleData: partial?.doodleData ?? null,
        isPinned: false,
        createdAt: now,
        updatedAt: now,
      };
      const next = [note, ...readAll()];
      persist(next);
      return note;
    },
    [persist]
  );

  const updateNote = useCallback(
    (id: string, patch: Partial<Omit<LocalNote, "id" | "createdAt">>) => {
      const current = readAll();
      const next = current.map((n) =>
        n.id === id
          ? { ...n, ...patch, updatedAt: new Date().toISOString() }
          : n
      );
      persist(next);
    },
    [persist]
  );

  const deleteNote = useCallback(
    (id: string) => {
      const next = readAll().filter((n) => n.id !== id);
      persist(next);
    },
    [persist]
  );

  const togglePin = useCallback(
    (id: string) => {
      const current = readAll();
      const next = current.map((n) =>
        n.id === id ? { ...n, isPinned: !n.isPinned } : n
      );
      persist(next);
    },
    [persist]
  );

  return { notes, loaded, storageError, createNote, updateNote, deleteNote, togglePin };
}
