"use client";

import React, { useState } from "react";
import { Priority, TaskStatus } from "@prisma/client";
import { createTask, updateTask } from "@/features/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { RECURRENCES, type Recurrence } from "@/lib/dates";
import TagInput from "./tag-input";
import { useTaskOptions } from "./use-task-options";

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  DAILY: "Every day",
  WEEKDAYS: "Every weekday",
  WEEKLY: "Every week",
  MONTHLY: "Every month",
  YEARLY: "Every year",
};

interface TaskFormProps {
  initialData?: Partial<Task>;
  /** Prefills for a new task, e.g. a due date when created from the calendar. */
  defaults?: { dueDate?: string; goalId?: string };
  onSuccess: () => void;
  onCancel: () => void;
}

export default function TaskForm({
  initialData,
  defaults,
  onSuccess,
  onCancel,
}: TaskFormProps) {
  const isEdit = !!initialData?.id;
  const { projects, goals, tags: tagSuggestions } = useTaskOptions();

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [priority, setPriority] = useState<Priority>(initialData?.priority || Priority.MEDIUM);
  const [status, setStatus] = useState<TaskStatus>(initialData?.status || TaskStatus.TODO);
  
  // Format Date for Input (YYYY-MM-DD)
  const formatInputDate = (dateString?: string | Date | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  const [dueDate, setDueDate] = useState(formatInputDate(initialData?.dueDate) || defaults?.dueDate || "");
  const [dueTime, setDueTime] = useState(initialData?.dueTime || "");
  const [estimatedTime, setEstimatedTime] = useState<string>(
    initialData?.estimatedTime ? initialData.estimatedTime.toString() : ""
  );
  const [projectId, setProjectId] = useState(initialData?.projectId || "");
  const [goalId, setGoalId] = useState(initialData?.goalId || defaults?.goalId || "");
  const [recurrence, setRecurrence] = useState<Recurrence | "">(
    (RECURRENCES as readonly string[]).includes(initialData?.recurrence ?? "") ? (initialData?.recurrence as Recurrence) : ""
  );
  const [tags, setTags] = useState<string[]>(initialData?.tags?.map((t) => t.tag.name) ?? []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      title,
      description: description || undefined,
      priority,
      status,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      estimatedTime: estimatedTime ? parseInt(estimatedTime, 10) : null,
      projectId: projectId || null,
      goalId: goalId || null,
      recurrence: recurrence || null,
      tags,
    };

    try {
      if (initialData?.id) {
        await updateTask(initialData.id, payload);
      } else {
        await createTask(payload);
      }
      onSuccess();
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {error && (
        <div className="p-3 text-xs font-medium text-red-450 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      {/* Task Title */}
      <div className="space-y-1">
        <Label htmlFor="title" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">
          Task Title
        </Label>
        <Input
          id="title"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-400 text-xs"
          required
          disabled={loading}
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label htmlFor="description" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">
          Description
        </Label>
        <Textarea
          id="description"
          placeholder="Add details, links, or instructions..."
          value={description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-400 text-xs min-h-[80px]"
          disabled={loading}
        />
      </div>

      {/* Status and Priority Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="status" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">
            Status
          </Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white focus:border-zinc-700 focus:outline-none"
            disabled={loading}
          >
            {Object.values(TaskStatus).map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="priority" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">
            Priority
          </Label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white focus:border-zinc-700 focus:outline-none"
            disabled={loading}
          >
            {Object.values(Priority).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Due Date & Estimates Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1 col-span-1.5">
          <Label htmlFor="dueDate" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">
            Due Date
          </Label>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white text-xs h-9"
            disabled={loading}
          />
        </div>

        <div className="space-y-1 col-span-0.5">
          <Label htmlFor="dueTime" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">
            Time
          </Label>
          <Input
            id="dueTime"
            type="time"
            placeholder="14:30"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white text-xs h-9"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="est" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">
            Est. Time (min)
          </Label>
          <Input
            id="est"
            type="number"
            placeholder="60"
            value={estimatedTime}
            onChange={(e) => setEstimatedTime(e.target.value)}
            className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white text-xs h-9"
            disabled={loading}
          />
        </div>
      </div>

      {/* Repeat + Goal */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="recurrence" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">
            Repeat
          </Label>
          <select
            id="recurrence"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence | "")}
            className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white focus:border-zinc-700 focus:outline-none"
            disabled={loading}
          >
            <option value="">Doesn&apos;t repeat</option>
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {RECURRENCE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="goal" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">
            Goal
          </Label>
          <select
            id="goal"
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white focus:border-zinc-700 focus:outline-none"
            disabled={loading}
          >
            <option value="">No goal</option>
            {/* Keep a completed goal selectable on tasks already linked to it. */}
            {initialData?.goal && !goals.some((g) => g.id === initialData.goal?.id) && (
              <option value={initialData.goal.id}>{initialData.goal.title}</option>
            )}
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      {recurrence && (
        <p className="-mt-2 text-[11px] text-zinc-400">
          Completing this task creates the next one automatically.
        </p>
      )}

      {/* Tags */}
      <div className="space-y-1">
        <Label className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Tags</Label>
        <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} disabled={loading} />
      </div>

      {/* Project Workspace Selector */}
      {projects.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="project" className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">
            Project Workspace
          </Label>
          <select
            id="project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white focus:border-zinc-700 focus:outline-none"
            disabled={loading}
          >
            <option value="">No Project Workspace</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Buttons Footer */}
      <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-900">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-zinc-850 hover:bg-zinc-900 text-zinc-300 text-xs h-9"
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="text-xs font-semibold h-9 px-4"
          disabled={loading}
        >
          {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Task"}
        </Button>
      </div>
    </form>
  );
}
