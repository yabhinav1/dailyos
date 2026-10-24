"use client";

import React, { useState } from "react";
import { TaskStatus, Priority } from "@prisma/client";
import { updateTask, toggleTaskFavorite, deleteTask } from "@/features/tasks/actions";
import {
  Calendar,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Star,
  Trash,
  Edit,
  AlertCircle,
  Repeat,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TaskDetailsDialog from "./task-details-dialog";
import { formatDay, isPastDue, localDateKey } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/types";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/stores/toast-store";

interface TaskListProps {
  tasks: Task[];
  onRefresh: () => void;
  onPatch?: (taskId: string, patch: Partial<Task>) => void;
}

export default function TaskList({ tasks, onRefresh, onPatch }: TaskListProps) {
  const confirm = useConfirm();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const handleStatusToggle = async (task: Task) => {
    const nextStatus =
      task.status === TaskStatus.COMPLETED ? TaskStatus.TODO : TaskStatus.COMPLETED;
    onPatch?.(task.id, { status: nextStatus });
    try {
      await updateTask(task.id, { status: nextStatus });
      onRefresh();
    } catch {
      onPatch?.(task.id, { status: task.status });
      toast.error("Couldn't update the task. Nothing was changed.");
    }
  };
  const todayKey = localDateKey();
  const handleFavoriteToggle = async (task: Task) => {
    await toggleTaskFavorite(task.id, !task.isFavorite);
    onRefresh();
  };
  const handleDelete = async (task: Task) => {
    const ok = await confirm({
      title: `Delete "${task.title}"?`,
      confirmLabel: "Delete task",
      destructive: true,
    });
    if (!ok) return;
    await deleteTask(task.id);
    onRefresh();
  };
  const openEditDialog = (task: Task) => {
    setSelectedTask(task);
    setShowEditDialog(true);
  };

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case Priority.CRITICAL:
        return "bg-red-500/10 text-red-500 border-red-500/25";
      case Priority.HIGH:
        return "bg-amber-500/10 text-amber-500 border-amber-500/25";
      case Priority.MEDIUM:
        return "bg-blue-500/10 text-blue-500 border-blue-500/25";
      case Priority.LOW:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-800";
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20">
        <p className="text-xs text-zinc-400">No tasks found matching your filter criteria.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-850 bg-[#0C0C0E]/40 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-850 bg-zinc-950/50 text-[11px] uppercase font-bold tracking-wider text-zinc-400">
              <th className="py-3 px-4 w-10"></th>
              <th className="py-3 px-2">Task</th>
              <th className="py-3 px-4 w-28">Status</th>
              <th className="py-3 px-4 w-28">Priority</th>
              <th className="py-3 px-4 w-32">Due Date</th>
              <th className="py-3 px-4 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/60">
            {tasks.map((task) => {
              const isCompleted = task.status === TaskStatus.COMPLETED;
              const isOverdue = isPastDue(task.dueDate, todayKey) && !isCompleted;

              return (
                <tr
                  key={task.id}
                  className="group hover:bg-zinc-950/40 transition-colors"
                >
                  {/* Complete Checkbox */}
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleStatusToggle(task)}
                      className="text-zinc-400 hover:text-blue-500 transition-colors"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-blue-500" />
                      ) : (
                        <Circle className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </td>

                  {/* Task details */}
                  <td className="py-3 px-2">
                    <div className="flex flex-col gap-1 pr-4">
                      <span
                        onClick={() => openEditDialog(task)}
                        className={`font-semibold cursor-pointer text-zinc-200 hover:text-white transition-colors ${
                          isCompleted ? "line-through text-zinc-650" : ""
                        }`}
                      >
                        {task.title}
                      </span>
                      {task.description && (
                        <span className="text-[11px] text-zinc-400 line-clamp-1 max-w-lg">
                          {task.description}
                        </span>
                      )}
                      {(task.tags.length > 0 || task.recurrence || task.goal) && (
                        <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          {task.recurrence && (
                            <Repeat className="h-3 w-3 text-zinc-400" aria-label={`Repeats ${task.recurrence.toLowerCase()}`} />
                          )}
                          {task.goal && <span className="text-emerald-400/90">◎ {task.goal.title}</span>}
                          {task.tags.map(({ tag }) => (
                            <span key={tag.id} className="text-zinc-300 bg-zinc-800/70 px-1.5 py-0.5 rounded">#{tag.name}</span>
                          ))}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="text-[11px] font-bold text-zinc-300 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-full uppercase">
                      {task.status.replace("_", " ")}
                    </span>
                  </td>

                  {/* Priority Badge */}
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold uppercase ${getPriorityColor(task.priority)}`}
                    >
                      {task.priority}
                    </Badge>
                  </td>

                  {/* Due date */}
                  <td className="py-3 px-4 whitespace-nowrap text-zinc-400">
                    {task.dueDate ? (
                      <span className={`flex items-center gap-1 text-[11px] ${isOverdue ? "text-red-400" : ""}`}>
                        {isOverdue ? (
                          <AlertCircle className="h-3 w-3 text-red-450" />
                        ) : (
                          <Calendar className="h-3 w-3" />
                        )}
                        {formatDay(task.dueDate)}
                      </span>
                    ) : (
                      <span className="text-zinc-700">-</span>
                    )}
                  </td>

                  {/* Menu actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleFavoriteToggle(task)}
                        className="text-zinc-400 hover:text-amber-500 p-1"
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${
                            task.isFavorite ? "fill-amber-500 text-amber-500" : ""
                          }`}
                        />
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger className="text-zinc-400 hover:text-zinc-200 focus:outline-none p-1 cursor-pointer">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#171717] border border-zinc-800 text-zinc-300 text-xs">
                          <DropdownMenuItem
                            onClick={() => openEditDialog(task)}
                            className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer flex items-center gap-2"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(task)}
                            className="hover:bg-zinc-900 focus:bg-red-950/30 focus:text-red-400 text-red-500 cursor-pointer flex items-center gap-2"
                          >
                            <Trash className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TaskDetailsDialog task={selectedTask} open={showEditDialog} onOpenChange={setShowEditDialog} onChanged={onRefresh} />
    </div>
  );
}
