"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Eye, Flag, GitBranch, Pencil, Plus } from "lucide-react";
import {
  addSharedTaskAction,
  getSharedProjectAction,
  setSharedMilestoneDoneAction,
  setSharedTaskDoneAction,
} from "@/features/projects/share-actions";
import { toast } from "@/stores/toast-store";
import { formatDay, isPastDue, localDateKey } from "@/lib/dates";

type SharedProject = Extract<Awaited<ReturnType<typeof getSharedProjectAction>>, { success: true }>["data"];

const POLL_MS = 5000;

/**
 * A project opened through its share link: progress, milestones and tasks.
 * Editors (and the owner) can tick tasks and milestones and add tasks;
 * viewers see the same page read-only. Refreshes every few seconds so
 * everyone sees each other's changes.
 */
export default function SharedProjectView({ token, initial }: { token: string; initial: SharedProject }) {
  const [project, setProject] = useState(initial);
  const [lostAccess, setLostAccess] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newDue, setNewDue] = useState("");
  const [busy, setBusy] = useState(false);
  const canEdit = project.role === "EDIT" || project.role === "OWNER";
  const today = localDateKey();

  const refresh = useCallback(async () => {
    const res = await getSharedProjectAction(token);
    if (res.success) setProject(res.data);
    else if (res.status === "not-found" || res.status === "no-access" || res.status === "sign-in") setLostAccess(true);
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Ticks land on screen immediately; the refresh that follows brings in
  // anything the change caused, such as a repeating task's next copy.
  const toggleTask = async (taskId: string, done: boolean) => {
    setProject((p) => ({
      ...p,
      tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, status: done ? "COMPLETED" : "TODO" } : t)),
    }));
    const res = await setSharedTaskDoneAction(token, taskId, done);
    if (!res.success) toast.error(res.message || "Couldn't update the task.");
    refresh();
  };

  const toggleMilestone = async (milestoneId: string, done: boolean) => {
    setProject((p) => ({
      ...p,
      milestones: p.milestones.map((m) => (m.id === milestoneId ? { ...m, isCompleted: done } : m)),
    }));
    const res = await setSharedMilestoneDoneAction(token, milestoneId, done);
    if (!res.success) toast.error(res.message || "Couldn't update the milestone.");
    refresh();
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setBusy(true);
    const res = await addSharedTaskAction(token, { title: newTask, dueDate: newDue || null });
    setBusy(false);
    if (!res.success) {
      toast.error(res.message || "Couldn't add the task.");
      return;
    }
    setNewTask("");
    setNewDue("");
    refresh();
  };

  if (lostAccess) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#0d0d0d] px-4 text-center text-zinc-300">
        <div className="space-y-2">
          <h1 className="text-lg font-bold text-white">This project is no longer shared with you</h1>
          <p className="text-sm text-zinc-400">The owner changed its sharing or removed it.</p>
        </div>
      </main>
    );
  }

  const done = project.tasks.filter((t) => t.status === "COMPLETED").length;
  const progress = project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0;
  const open = project.tasks.filter((t) => t.status !== "COMPLETED");
  const finished = project.tasks.filter((t) => t.status === "COMPLETED");

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-zinc-200">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-900 bg-[#0d0d0d]/95 px-4 py-2.5 backdrop-blur sm:px-8">
        <Link href={project.signedIn ? "/today" : "/"} className="flex items-center gap-2 text-sm font-bold text-white shrink-0" aria-label="DailyOS home">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-500">
            <GitBranch className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">DailyOS</span>
        </Link>
        <div className="min-w-0 flex-1 text-xs text-zinc-400 truncate">
          {project.role === "OWNER" ? "Your project" : <>Shared by <span className="text-zinc-200">{project.owner}</span></>}
        </div>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0 ${
            canEdit ? "bg-blue-500/15 text-blue-300" : "bg-zinc-800 text-zinc-300"
          }`}
        >
          {canEdit ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {project.role === "OWNER" ? "Owner" : canEdit ? "Can edit" : "View only"}
        </span>
        {!project.signedIn && (
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/p/${token}`)}`} className="text-xs text-blue-400 hover:text-blue-300 shrink-0">
            Sign in
          </Link>
        )}
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 space-y-6">
        <section className="space-y-2">
          <h1 className={`text-2xl font-bold text-white ${project.isCompleted ? "line-through text-zinc-400" : ""}`}>{project.name}</h1>
          {project.description && <p className="text-sm text-zinc-400 whitespace-pre-wrap">{project.description}</p>}
          <div className="flex items-center gap-3 pt-1 text-xs text-zinc-400">
            <span>
              {done}/{project.tasks.length} tasks done
            </span>
            {project.deadline && <span>Due {formatDay(project.deadline, { month: "short", day: "numeric", year: "numeric" })}</span>}
          </div>
          <div className="h-2 rounded-full bg-zinc-900 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Project progress">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </section>

        {project.milestones.length > 0 && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
              <Flag className="h-3.5 w-3.5" /> Milestones
            </h2>
            <ul className="space-y-1">
              {project.milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-950/60">
                  <Tick done={m.isCompleted} label={m.title} disabled={!canEdit} onToggle={() => toggleMilestone(m.id, !m.isCompleted)} />
                  <span className={`flex-1 text-sm ${m.isCompleted ? "line-through text-zinc-500" : "text-zinc-200"}`}>{m.title}</span>
                  {m.dueDate && <span className="text-[11px] text-zinc-400">{formatDay(m.dueDate)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Tasks</h2>
          {canEdit && (
            <form onSubmit={addTask} className="flex flex-wrap items-center gap-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Add a task"
                aria-label="New task"
                className="flex-1 min-w-[160px] h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-900/50 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-700"
                disabled={busy}
              />
              <input
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                aria-label="Due date"
                className="h-9 px-2 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs text-white outline-none focus:border-zinc-700"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !newTask.trim()}
                className="h-9 px-3 inline-flex items-center gap-1 rounded-lg bg-zinc-100 text-zinc-900 text-xs font-semibold hover:bg-white disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </form>
          )}
          {project.tasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">No tasks in this project yet.</p>
          ) : (
            <ul className="space-y-1">
              {[...open, ...finished].map((t) => {
                const isDone = t.status === "COMPLETED";
                const overdue = !isDone && isPastDue(t.dueDate, today);
                return (
                  <li key={t.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-950/60">
                    <Tick done={isDone} label={t.title} disabled={!canEdit} onToggle={() => toggleTask(t.id, !isDone)} />
                    <span className={`flex-1 min-w-0 truncate text-sm ${isDone ? "line-through text-zinc-500" : "text-zinc-200"}`}>{t.title}</span>
                    {t.priority === "HIGH" || t.priority === "CRITICAL" ? (
                      <span className={`text-[10px] font-bold ${t.priority === "CRITICAL" ? "text-red-400" : "text-amber-400"}`}>{t.priority}</span>
                    ) : null}
                    {t.dueDate && <span className={`text-[11px] ${overdue ? "text-red-400" : "text-zinc-400"}`}>{formatDay(t.dueDate)}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Tick({ done, label, disabled, onToggle }: { done: boolean; label: string; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={done ? `Mark "${label}" not done` : `Mark "${label}" done`}
      className="shrink-0 text-zinc-400 hover:text-blue-500 disabled:hover:text-zinc-400 disabled:cursor-default"
    >
      {done ? <CheckCircle2 className="h-4.5 w-4.5 text-blue-500" /> : <Circle className="h-4.5 w-4.5" />}
    </button>
  );
}
