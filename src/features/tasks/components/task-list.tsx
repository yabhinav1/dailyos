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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TaskForm from "./task-form";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/types";

interface TaskListProps {
  tasks: Task[];
  onRefresh: () => void;
  projects?: { id: string; name: string }[];
}

export default function TaskList({ tasks, onRefresh, projects = [] }: TaskListProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const handleStatusToggle = async (task: Task) => {
    const nextStatus =
      task.status === TaskStatus.COMPLETED ? TaskStatus.TODO : TaskStatus.COMPLETED;
    await updateTask(task.id, { status: nextStatus });
    onRefresh();
  };
  const handleFavoriteToggle = async (task: Task) => {
    await toggleTaskFavorite(task.id, !task.isFavorite);
    onRefresh();
  };
  const handleDelete = async (task: Task) => {
    if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
      await deleteTask(task.id);
      onRefresh();
    }
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
        return "bg-zinc-500/10 text-zinc-500 border-zinc-800";
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20">
        <p className="text-xs text-zinc-500">No tasks found matching your filter criteria.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-850 bg-[#0C0C0E]/40 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-850 bg-zinc-950/50 text-[10px] uppercase font-bold tracking-wider text-zinc-500">
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
              const isOverdue =
                task.dueDate &&
                new Date(task.dueDate) < new Date() &&
                !isCompleted;

              return (
                <tr
                  key={task.id}
                  className="group hover:bg-zinc-950/40 transition-colors"
                >
                  {/* Complete Checkbox */}
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleStatusToggle(task)}
                      className="text-zinc-600 hover:text-blue-500 transition-colors"
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
                        <span className="text-[10px] text-zinc-500 line-clamp-1 max-w-lg">
                          {task.description}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="text-[9px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-full uppercase">
                      {task.status.replace("_", " ")}
                    </span>
                  </td>

                  {/* Priority Badge */}
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-semibold uppercase ${getPriorityColor(task.priority)}`}
                    >
                      {task.priority}
                    </Badge>
                  </td>

                  {/* Due date */}
                  <td className="py-3 px-4 whitespace-nowrap text-zinc-500">
                    {task.dueDate ? (
                      <span className={`flex items-center gap-1 text-[10px] ${isOverdue ? "text-red-400" : ""}`}>
                        {isOverdue ? (
                          <AlertCircle className="h-3 w-3 text-red-450" />
                        ) : (
                          <Calendar className="h-3 w-3" />
                        )}
                        {new Date(task.dueDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
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
                        className="text-zinc-600 hover:text-amber-500 p-1"
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${
                            task.isFavorite ? "fill-amber-500 text-amber-500" : ""
                          }`}
                        />
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger className="text-zinc-600 hover:text-zinc-300 focus:outline-none p-1 cursor-pointer">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#171717] border border-zinc-800 text-zinc-400 text-xs">
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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white">Edit Task Details</DialogTitle>
          </DialogHeader>
          <TaskForm
            initialData={selectedTask ?? undefined}
            projects={projects}
            onSuccess={() => {
              setShowEditDialog(false);
              onRefresh();
            }}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
