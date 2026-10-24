"use client";

import React, { useState } from "react";
import { Priority, TaskStatus } from "@prisma/client";
import { toggleTaskFavorite, deleteTask } from "@/features/tasks/actions";
import {
  Calendar,
  CheckSquare,
  Clock,
  MoreVertical,
  Star,
  Trash,
  Edit,
  AlertCircle,
  Repeat,
  Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TaskDetailsDialog from "./task-details-dialog";
import type { Task } from "@/lib/types";
import { formatDay, isPastDue, localDateKey } from "@/lib/dates";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface TaskCardProps {
  task: Task;
  onRefresh: () => void;
}

export default function TaskCard({ task, onRefresh }: TaskCardProps) {
  const confirm = useConfirm();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [favorite, setFavorite] = useState(task.isFavorite);

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextState = !favorite;
    setFavorite(nextState);
    await toggleTaskFavorite(task.id, nextState);
    onRefresh();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm({
      title: `Delete "${task.title}"?`,
      confirmLabel: "Delete task",
      destructive: true,
    });
    if (!ok) return;
    await deleteTask(task.id);
    onRefresh();
  };

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case Priority.CRITICAL:
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case Priority.HIGH:
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case Priority.MEDIUM:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case Priority.LOW:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-800";
    }
  };

  const getStatusLabel = (s: TaskStatus) => {
    return s.replace("_", " ");
  };

  // Determine if task is overdue
  const isOverdue = isPastDue(task.dueDate, localDateKey()) && task.status !== TaskStatus.COMPLETED;

  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.isCompleted).length || 0;

  return (
    <>
      <Card className="group relative border-zinc-850 bg-[#0C0C0E]/40 hover:bg-zinc-950/60 hover:border-zinc-800 transition-all duration-200 shadow-sm cursor-pointer">
        <CardContent className="p-4 space-y-3.5">
          {/* Header row: title and dropdown actions */}
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-xs font-semibold text-zinc-200 line-clamp-2 leading-relaxed">
              {task.title}
            </h4>
            <div className="flex items-center gap-1 shrink-0">
              {/* Star Button */}
              <button
                onClick={handleFavoriteToggle}
                className="text-zinc-400 hover:text-amber-500 transition-colors p-1"
              >
                <Star
                  className={`h-3.5 w-3.5 ${
                    favorite ? "fill-amber-500 text-amber-500" : ""
                  }`}
                />
              </button>

              {/* Action Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger className="text-zinc-400 hover:text-zinc-200 focus:outline-none p-1 cursor-pointer">
                  <MoreVertical className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#171717] border border-zinc-800 text-zinc-300 text-xs">
                  <DropdownMenuItem
                    onClick={() => setShowEditDialog(true)}
                    className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer flex items-center gap-2"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Edit Task</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="hover:bg-zinc-900 focus:bg-red-950/30 focus:text-red-400 text-red-500 cursor-pointer flex items-center gap-2"
                  >
                    <Trash className="h-3.5 w-3.5" />
                    <span>Delete Task</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Description snippet if exists */}
          {task.description && (
            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Badges / Indicators row */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-900/60 text-[11px]">
            {/* Status Indicator */}
            <span className="text-[11px] text-zinc-400 font-medium px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-850 uppercase">
              {getStatusLabel(task.status)}
            </span>

            {/* Priority Badge */}
            <Badge variant="outline" className={`text-[11px] font-semibold border ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </Badge>

            {/* Project Indicator */}
            {task.project && (
              <span className="text-zinc-400 bg-zinc-900/40 px-1.5 py-0.5 rounded border border-transparent">
                💼 {task.project.name}
              </span>
            )}

            {/* Linked goal */}
            {task.goal && (
              <span className="flex items-center gap-1 text-emerald-400/90" title={`Goal: ${task.goal.title}`}>
                <Target className="h-3 w-3" />
                <span className="max-w-[90px] truncate">{task.goal.title}</span>
              </span>
            )}

            {/* Repeats */}
            {task.recurrence && (
              <span className="flex items-center text-zinc-400" title={`Repeats ${task.recurrence.toLowerCase()}`}>
                <Repeat className="h-3 w-3" />
              </span>
            )}

            {/* Tags */}
            {task.tags.map(({ tag }) => (
              <span key={tag.id} className="text-zinc-300 bg-zinc-800/70 px-1.5 py-0.5 rounded">
                #{tag.name}
              </span>
            ))}

            {/* Subtask count */}
            {totalSubtasks > 0 && (
              <span className="flex items-center gap-1 text-zinc-400">
                <CheckSquare className="h-3 w-3" />
                {completedSubtasks}/{totalSubtasks}
              </span>
            )}

            {/* Due date status */}
            {task.dueDate && (
              <span
                className={`flex items-center gap-1 ml-auto font-medium ${
                  isOverdue ? "text-red-400" : "text-zinc-400"
                }`}
              >
                {isOverdue ? (
                  <AlertCircle className="h-3 w-3 text-red-400" />
                ) : (
                  <Calendar className="h-3 w-3 text-zinc-400" />
                )}
                {formatDay(task.dueDate)}
              </span>
            )}

            {/* Estimated/Actual Times */}
            {task.estimatedTime && (
              <span className="flex items-center gap-1 text-zinc-400">
                <Clock className="h-3 w-3" />
                {task.estimatedTime}m
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <TaskDetailsDialog task={task} open={showEditDialog} onOpenChange={setShowEditDialog} onChanged={onRefresh} />
    </>
  );
}
