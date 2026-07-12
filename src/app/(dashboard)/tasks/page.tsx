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

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filters State
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "ALL">("ALL");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch Tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const filters: any = {
      search: search || undefined,
      status: status === "ALL" ? undefined : status,
      priority: priority === "ALL" ? undefined : priority,
      sortBy,
      sortOrder,
    };

    const res = await getTasksAction(filters);
    if (res.success && res.data) {
      setTasks(res.data);
    }
    setLoading(false);
  }, [search, status, priority, sortBy, sortOrder]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="h-5.5 w-5.5 text-blue-500" />
            Tasks Board
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Manage and track your private productivity items</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* List vs Kanban toggles */}
          <Tabs value={view} onValueChange={(val: any) => setView(val)} className="h-8">
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
            className="bg-blue-600 hover:bg-blue-500 text-white gap-1 text-xs font-semibold h-8 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            New Task
          </Button>
        </div>
      </div>

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
                <TaskList tasks={tasks} onRefresh={fetchTasks} />
              ) : (
                <TaskKanban tasks={tasks} onRefresh={fetchTasks} />
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
              fetchTasks();
            }}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
