"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getTrashAction, restoreTrashItem, deleteTrashItemForever, emptyTrash } from "@/features/trash/actions";
import type { TrashItemRef } from "@/features/trash/actions";
import { CheckSquare, FileText, FolderOpen, RotateCcw, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/stores/toast-store";
import { cn } from "@/lib/utils";
import type { TrashData } from "@/lib/types";

type TrashKind = TrashItemRef["kind"];
type Filter = "all" | TrashKind;

/** One row of the list, whatever kind of thing was deleted. */
type TrashRow = {
  kind: TrashKind;
  id: string;
  title: string;
  detail: string | null;
  deletedAt: Date | null;
  /** Shown in the "Delete forever" confirmation. */
  consequence: string;
};

const KINDS: Record<TrashKind, { label: string; noun: string; href: string; icon: typeof FileText; accent: string }> = {
  note: { label: "Notes", noun: "Note", href: "/notes", icon: FileText, accent: "text-blue-400" },
  task: { label: "Tasks", noun: "Task", href: "/tasks", icon: CheckSquare, accent: "text-emerald-400" },
  project: { label: "Projects", noun: "Project", href: "/projects", icon: FolderOpen, accent: "text-violet-400" },
};
const KIND_ORDER: TrashKind[] = ["note", "task", "project"];

const DAY_MS = 24 * 60 * 60 * 1000;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function toRows(data: TrashData): TrashRow[] {
  const notes = data.notes.map<TrashRow>((n) => ({
    kind: "note",
    id: n.id,
    title: n.title,
    detail: n.folder ? `In ${n.folder.name}` : null,
    deletedAt: n.deletedAt,
    consequence: "This can't be undone.",
  }));
  const tasks = data.tasks.map<TrashRow>((t) => ({
    kind: "task",
    id: t.id,
    title: t.title,
    detail: t.project ? `Project · ${t.project.name}` : t.category ? t.category.name : null,
    deletedAt: t.deletedAt,
    consequence: "Its subtasks and checklist go with it. This can't be undone.",
  }));
  const projects = data.projects.map<TrashRow>((p) => {
    const tasks = p._count.tasks;
    const files = p._count.resources;
    return {
      kind: "project",
      id: p.id,
      title: p.name,
      detail: `${plural(tasks, "task")} · ${plural(files, "attachment")}`,
      deletedAt: p.deletedAt,
      consequence: [
        "Its milestones are deleted",
        files > 0 ? `, along with ${plural(files, "attachment")}` : "",
        ". ",
        tasks > 0 ? `${plural(tasks, "task")} will stay, unlinked from the project. ` : "",
        "This can't be undone.",
      ].join(""),
    };
  });
  return [...notes, ...tasks, ...projects];
}

/** "Deleted 3 days ago · removed in 27 days" */
function describeTiming(deletedAt: Date | null, now: number, retentionDays: number) {
  const elapsed = deletedAt ? Math.max(0, now - new Date(deletedAt).getTime()) : 0;
  const ago = Math.floor(elapsed / DAY_MS);
  const left = Math.ceil((retentionDays * DAY_MS - elapsed) / DAY_MS);

  const deleted = ago === 0 ? "Deleted today" : ago === 1 ? "Deleted yesterday" : `Deleted ${ago} days ago`;
  // The purge runs once a day, so anything past its window goes on the next run.
  const removed = left <= 0 ? "removed at next cleanup" : `removed in ${plural(left, "day")}`;
  return { text: `${deleted} · ${removed}`, soon: left <= 3 };
}

export default function TrashPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [rows, setRows] = useState<TrashRow[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [emptying, setEmptying] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);
  const reloadTrash = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getTrashAction();
      if (cancelled) return;
      if (res.success && res.data) {
        setRows(toRows(res.data));
        setRetentionDays(res.data.retentionDays);
      } else {
        toast.error(res.message || "Couldn't load the trash.");
      }
      setNow(Date.now());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const removeRow = (row: TrashRow) =>
    setRows((prev) => prev.filter((r) => !(r.kind === row.kind && r.id === row.id)));

  const handleRestore = async (row: TrashRow) => {
    removeRow(row);
    const res = await restoreTrashItem({ kind: row.kind, id: row.id });
    if (!res.success) {
      reloadTrash();
      toast.error(res.message || "Couldn't restore that item.");
      return;
    }
    toast.success(`"${row.title}" restored.`, {
      label: `Go to ${KINDS[row.kind].label}`,
      onClick: () => router.push(KINDS[row.kind].href),
    });
  };

  const handleDeleteForever = async (row: TrashRow) => {
    const ok = await confirm({
      title: `Delete "${row.title}" forever?`,
      body: row.consequence,
      confirmLabel: "Delete forever",
      destructive: true,
    });
    if (!ok) return;

    removeRow(row);
    const res = await deleteTrashItemForever({ kind: row.kind, id: row.id });
    if (!res.success) {
      reloadTrash();
      toast.error(res.message || "Couldn't delete that item.");
      return;
    }
    toast.success(`${KINDS[row.kind].noun} permanently deleted.`);
  };

  const handleEmptyTrash = async () => {
    const ok = await confirm({
      title: "Empty the trash?",
      body: `${plural(rows.length, "item")} will be permanently deleted, including any files attached only to deleted projects or tasks. This can't be undone.`,
      confirmLabel: "Empty trash",
      destructive: true,
    });
    if (!ok) return;

    setEmptying(true);
    const previous = rows;
    setRows([]);
    const res = await emptyTrash();
    setEmptying(false);
    if (!res.success) {
      setRows(previous);
      toast.error(res.message || "Couldn't empty the trash.");
      return;
    }
    toast.success("Trash emptied.");
    // Picks up anything trashed elsewhere meanwhile, or left over past a batch.
    reloadTrash();
  };

  const counts = Object.fromEntries(
    KIND_ORDER.map((k) => [k, rows.filter((r) => r.kind === k).length])
  ) as Record<TrashKind, number>;
  const visibleKinds = filter === "all" ? KIND_ORDER : [filter];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Trash2 className="h-5.5 w-5.5 text-zinc-200" />
            Trash
          </h1>
          <p className="text-xs text-zinc-300 mt-1">
            Deleted notes, tasks and projects are kept for {retentionDays} days, then removed for good
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleEmptyTrash}
          disabled={loading || emptying || rows.length === 0}
          className="gap-1 text-xs font-semibold h-8 shrink-0 border-red-900/60 text-red-400 hover:bg-red-950/40 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {emptying ? "Emptying..." : "Empty trash"}
        </Button>
      </div>

      {/* Kind filter */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...KIND_ORDER] as Filter[]).map((f) => {
          const count = f === "all" ? rows.length : counts[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                filter === f
                  ? "border-zinc-700 bg-zinc-900 text-white"
                  : "border-zinc-850 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200"
              )}
            >
              {f === "all" ? "All" : KINDS[f].label}
              {!loading && <span className="font-mono text-[11px] text-zinc-500">{count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : visibleKinds.every((k) => counts[k] === 0) ? (
        <div className="py-16 text-center border border-dashed border-zinc-850 rounded-xl">
          <Trash2 className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-300">Trash is empty</p>
          <p className="text-xs text-zinc-400 mt-1">
            Anything you delete shows up here for {retentionDays} days before it&apos;s gone for good
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleKinds.map((kind) => {
            const items = rows.filter((r) => r.kind === kind);
            if (items.length === 0) return null;
            const { label, icon: Icon, accent } = KINDS[kind];
            return (
              <section key={kind} className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Icon className={cn("h-3.5 w-3.5", accent)} />
                  {label}
                  <span className="font-mono text-zinc-500">{items.length}</span>
                </h2>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {items.map((row) => {
                      const timing = describeTiming(row.deletedAt, now, retentionDays);
                      return (
                        <motion.div
                          key={`${row.kind}:${row.id}`}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="flex flex-col gap-3 rounded-xl border border-zinc-850 bg-[#0C0C0E]/40 p-4 hover:border-zinc-800 transition-colors sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", accent)} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-zinc-100">{row.title}</p>
                              <p className="text-[11px] text-zinc-400 mt-0.5">
                                {row.detail && <span>{row.detail} · </span>}
                                <span className={timing.soon ? "text-amber-400" : undefined}>{timing.text}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestore(row)}
                              className="gap-1 border-zinc-800 text-xs text-zinc-200 h-7 cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteForever(row)}
                              className="gap-1 text-xs text-zinc-400 hover:bg-red-950/40 hover:text-red-400 h-7 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                              Delete forever
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
