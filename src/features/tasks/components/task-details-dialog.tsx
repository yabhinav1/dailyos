"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addTaskComment,
  createSubtask,
  deleteSubtask,
  deleteTaskComment,
  getTaskDetailsAction,
  toggleSubtask,
} from "@/features/tasks/actions";
import TaskForm from "./task-form";
import type { Task } from "@/lib/types";
import { toast } from "@/stores/toast-store";

type Details = NonNullable<Awaited<ReturnType<typeof getTaskDetailsAction>>["data"]>;

interface TaskDetailsDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after anything changes, so the list behind the dialog refreshes. */
  onChanged: () => void;
}

/** Edit form plus the subtasks and comments that only an existing task has. */
export default function TaskDetailsDialog({ task, open, onOpenChange, onChanged }: TaskDetailsDialogProps) {
  const [details, setDetails] = useState<Details | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const taskId = open ? task?.id : undefined;
  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    (async () => {
      const res = await getTaskDetailsAction(taskId);
      if (!cancelled && res.success && res.data) setDetails(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [taskId, reloadToken]);

  // Drop the previous task's details while the next one loads.
  const shown = details && details.id === taskId ? details : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-white">Edit Task Details</DialogTitle>
        </DialogHeader>
        {task && (
          <TaskForm
            key={task.id}
            initialData={task}
            onSuccess={() => {
              onOpenChange(false);
              onChanged();
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
        {task && shown && (
          <div className="space-y-5 border-t border-zinc-900 pt-4">
            <Subtasks
              taskId={task.id}
              items={shown.subtasks}
              onChanged={() => {
                reload();
                onChanged();
              }}
            />
            <Comments taskId={task.id} items={shown.notes} onChanged={reload} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Subtasks({
  taskId,
  items,
  onChanged,
}: {
  taskId: string;
  items: Details["subtasks"];
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch {
      toast.error(failure);
    } finally {
      setBusy(false);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    setTitle("");
    run(() => createSubtask(taskId, text), "Couldn't add the subtask.");
  };

  const done = items.filter((s) => s.isCompleted).length;

  return (
    <section className="space-y-2">
      <h3 className="text-[11px] uppercase font-bold tracking-wider text-zinc-300">
        Subtasks {items.length > 0 && <span className="text-zinc-400 font-medium">· {done}/{items.length}</span>}
      </h3>
      <ul className="space-y-1">
        {items.map((s) => (
          <li key={s.id} className="group flex items-center gap-2 text-xs">
            <button
              type="button"
              aria-label={s.isCompleted ? `Mark "${s.title}" not done` : `Mark "${s.title}" done`}
              onClick={() => run(() => toggleSubtask(s.id, !s.isCompleted), "Couldn't update the subtask.")}
              disabled={busy}
              className="text-zinc-400 hover:text-blue-500"
            >
              {s.isCompleted ? <CheckCircle2 className="h-4 w-4 text-blue-500" /> : <Circle className="h-4 w-4" />}
            </button>
            <span className={`flex-1 ${s.isCompleted ? "line-through text-zinc-500" : "text-zinc-200"}`}>{s.title}</span>
            <button
              type="button"
              aria-label={`Delete subtask "${s.title}"`}
              onClick={() => run(() => deleteSubtask(s.id), "Couldn't delete the subtask.")}
              disabled={busy}
              className="opacity-0 pointer-coarse:opacity-100 group-hover:opacity-100 focus:opacity-100 text-zinc-400 hover:text-red-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a subtask"
          aria-label="New subtask"
          className="flex-1 h-8 px-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs text-white placeholder-zinc-400 outline-none focus:border-zinc-700"
          disabled={busy}
        />
        <button
          type="submit"
          aria-label="Add subtask"
          disabled={busy || !title.trim()}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </form>
    </section>
  );
}

function Comments({
  taskId,
  items,
  onChanged,
}: {
  taskId: string;
  items: Details["notes"];
  onChanged: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addTaskComment(taskId, text);
      setText("");
      onChanged();
    } catch {
      toast.error("Couldn't save the comment.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteTaskComment(id);
      onChanged();
    } catch {
      toast.error("Couldn't delete the comment.");
    }
  };

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] uppercase font-bold tracking-wider text-zinc-300">
        <MessageSquare className="h-3 w-3" /> Comments
      </h3>
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id} className="group rounded-lg border border-zinc-850 bg-zinc-950/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-zinc-200 whitespace-pre-wrap break-words">{c.content}</p>
                <button
                  type="button"
                  aria-label="Delete comment"
                  onClick={() => remove(c.id)}
                  className="opacity-0 pointer-coarse:opacity-100 group-hover:opacity-100 focus:opacity-100 text-zinc-400 hover:text-red-400 shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">
                {new Date(c.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(e);
          }}
          placeholder="Add a note or progress update… (Ctrl+Enter to save)"
          aria-label="New comment"
          rows={2}
          className="w-full px-2.5 py-2 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs text-white placeholder-zinc-400 outline-none focus:border-zinc-700 resize-none"
          disabled={busy}
        />
        {text.trim() && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="h-7 px-3 rounded-lg bg-zinc-100 text-zinc-900 text-[11px] font-semibold hover:bg-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Comment"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
