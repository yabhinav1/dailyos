"use client";

import React, { useState } from "react";
import { Priority, TaskStatus } from "@prisma/client";
import { createTask, updateTask } from "@/features/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TaskFormProps {
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
  projects?: { id: string; name: string }[];
}

export default function TaskForm({
  initialData,
  onSuccess,
  onCancel,
  projects = [],
}: TaskFormProps) {
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [priority, setPriority] = useState<Priority>(initialData?.priority || Priority.MEDIUM);
  const [status, setStatus] = useState<TaskStatus>(initialData?.status || TaskStatus.TODO);
  
  // Format Date for Input (YYYY-MM-DD)
  const formatInputDate = (dateString?: string | Date) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  const [dueDate, setDueDate] = useState(formatInputDate(initialData?.dueDate));
  const [dueTime, setDueTime] = useState(initialData?.dueTime || "");
  const [estimatedTime, setEstimatedTime] = useState<string>(
    initialData?.estimatedTime ? initialData.estimatedTime.toString() : ""
  );
  const [projectId, setProjectId] = useState(initialData?.projectId || "");

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
    };

    try {
      if (isEdit) {
        await updateTask(initialData.id, payload);
      } else {
        await createTask(payload);
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong. Please try again.");
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
        <Label htmlFor="title" className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
          Task Title
        </Label>
        <Input
          id="title"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-500 text-xs"
          required
          disabled={loading}
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label htmlFor="description" className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
          Description
        </Label>
        <Textarea
          id="description"
          placeholder="Add details, links, or instructions..."
          value={description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-500 text-xs min-h-[80px]"
          disabled={loading}
        />
      </div>

      {/* Status and Priority Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="status" className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
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
          <Label htmlFor="priority" className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
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
          <Label htmlFor="dueDate" className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
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
          <Label htmlFor="dueTime" className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
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
          <Label htmlFor="est" className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
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

      {/* Project Workspace Selector */}
      {projects.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="project" className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
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
          className="border-zinc-850 hover:bg-zinc-900 text-zinc-400 text-xs h-9"
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold h-9"
          disabled={loading}
        >
          {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Task"}
        </Button>
      </div>
    </form>
  );
}
