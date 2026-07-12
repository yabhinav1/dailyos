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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TaskForm from "./task-form";

interface TaskCardProps {
  task: any;
  onRefresh: () => void;
  projects?: { id: string; name: string }[];
}

export default function TaskCard({ task, onRefresh, projects = [] }: TaskCardProps) {
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
    if (confirm("Are you sure you want to delete this task?")) {
      await deleteTask(task.id);
      onRefresh();
    }
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
        return "bg-zinc-500/10 text-zinc-500 border-zinc-800";
    }
  };

  const getStatusLabel = (s: TaskStatus) => {
    return s.replace("_", " ");
  };

  // Determine if task is overdue
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;

  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((s: any) => s.isCompleted).length || 0;

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
                className="text-zinc-600 hover:text-amber-500 transition-colors p-1"
              >
                <Star
                  className={`h-3.5 w-3.5 ${
                    favorite ? "fill-amber-500 text-amber-500" : ""
                  }`}
                />
              </button>

              {/* Action Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger className="text-zinc-600 hover:text-zinc-300 focus:outline-none p-1 cursor-pointer">
                  <MoreVertical className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#171717] border border-zinc-800 text-zinc-400 text-xs">
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
            <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Badges / Indicators row */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-900/60 text-[10px]">
            {/* Status Indicator */}
            <span className="text-[10px] text-zinc-500 font-medium px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-850 uppercase">
              {getStatusLabel(task.status)}
            </span>

            {/* Priority Badge */}
            <Badge variant="outline" className={`text-[9px] font-semibold border ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </Badge>

            {/* Project Indicator */}
            {task.project && (
              <span className="text-zinc-500 bg-zinc-900/40 px-1.5 py-0.5 rounded border border-transparent">
                💼 {task.project.name}
              </span>
            )}

            {/* Subtask count */}
            {totalSubtasks > 0 && (
              <span className="flex items-center gap-1 text-zinc-500">
                <CheckSquare className="h-3 w-3" />
                {completedSubtasks}/{totalSubtasks}
              </span>
            )}

            {/* Due date status */}
            {task.dueDate && (
              <span
                className={`flex items-center gap-1 ml-auto font-medium ${
                  isOverdue ? "text-red-400" : "text-zinc-500"
                }`}
              >
                {isOverdue ? (
                  <AlertCircle className="h-3 w-3 text-red-400" />
                ) : (
                  <Calendar className="h-3 w-3 text-zinc-500" />
                )}
                {new Date(task.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}

            {/* Estimated/Actual Times */}
            {task.estimatedTime && (
              <span className="flex items-center gap-1 text-zinc-500">
                <Clock className="h-3 w-3" />
                {task.estimatedTime}m
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Task Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-white">Edit Task Details</DialogTitle>
          </DialogHeader>
          <TaskForm
            initialData={task}
            projects={projects}
            onSuccess={() => {
              setShowEditDialog(false);
              onRefresh();
            }}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
