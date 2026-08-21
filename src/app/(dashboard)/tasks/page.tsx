"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Priority, TaskStatus } from "@prisma/client";
import { getTasksAction } from "@/features/tasks/actions";
import { CheckSquare, LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TaskFilters from "@/features/tasks/components/task-filters";
import TaskList from "@/features/tasks/components/task-list";
import TaskKanban from "@/features/tasks/components/task-kanban";
import { motion, AnimatePresence } from "framer-motion";
import TaskForm from "@/features/tasks/components/task-form";
import { Loader } from "@/components/ui/loader";
import type { Task } from "@/lib/types";
import type { TaskFilters as TaskFilterValues } from "@/features/tasks/queries";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filters State
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "ALL">("ALL");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [reloadToken, setReloadToken] = useState(0);
  const reloadTasks = useCallback(() => setReloadToken((n) => n + 1), []);

  // Fetch Tasks. A filter can change while a request is still in flight, so
  // stale responses are dropped rather than overwriting the newer result.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const filters: TaskFilterValues = {
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
        priority: priority === "ALL" ? undefined : priority,
        sortBy,
        sortOrder,
      };

      const res = await getTasksAction(filters);
      if (cancelled) return;
      if (res.success && res.data) {
        setTasks(res.data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [search, status, priority, sortBy, sortOrder, reloadToken]);

  // The TaskStatus enum has no "DONE" member — this compared against a value
  // that can never occur, so the progress bar was permanently stuck at 0%.
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;
  const totalCount = tasks.length;
  const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="h-5.5 w-5.5 text-zinc-300" />
            Tasks Board
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Manage and track your private productivity items</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* List vs Kanban toggles */}
          <Tabs value={view} onValueChange={(val) => setView(val as "list" | "kanban")} className="h-8">
            <TabsList className="bg-zinc-950 border border-zinc-850 p-0.5 h-8">
              <TabsTrigger
                value="list"
                className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white text-[11px] h-7 px-2.5 flex items-center gap-1 text-zinc-500 cursor-pointer"
              >
                <List className="h-3.5 w-3.5" />
                <span>List</span>
              </TabsTrigger>
              <TabsTrigger
                value="kanban"
                className="data-[state=active]:bg-zinc-900 data-[state=active]:text-white text-[11px] h-7 px-2.5 flex items-center gap-1 text-zinc-500 cursor-pointer"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Kanban</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Create button */}
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="gap-1 text-xs font-semibold h-8 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            New Task
          </Button>
        </div>
      </div>

      {/* Task Completion Progress Widget */}
      {totalCount > 0 && (
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300">Overall Task Completion</span>
            <span className="font-mono text-zinc-400">{completedCount} of {totalCount} completed ({percentComplete}%)</span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-900 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentComplete === 100 ? "bg-emerald-500" : percentComplete > 50 ? "bg-blue-500" : "bg-amber-500"
              }`}
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <TaskFilters
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        priority={priority}
        setPriority={setPriority}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      {/* Render list/kanban content */}
      <div className="pt-2">
        {loading ? (
          <div className="py-24 text-center">
            <Loader />
            <p className="text-[11px] text-zinc-500 mt-2 font-medium">Fetching active tasks...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              {view === "list" ? (
                <TaskList tasks={tasks} onRefresh={reloadTasks} />
              ) : (
                <TaskKanban tasks={tasks} onRefresh={reloadTasks} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white">Create New Task</DialogTitle>
          </DialogHeader>
          <TaskForm
            onSuccess={() => {
              setShowCreateDialog(false);
              reloadTasks();
            }}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
