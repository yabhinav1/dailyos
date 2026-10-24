"use client";

import React, { useState } from "react";
import { createCodingProject, updateCodingProject } from "@/features/developer/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CodingProject } from "@/lib/types";
import { toast } from "@/stores/toast-store";

const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "COMPLETED", "ON_HOLD"] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const labelClass = "text-zinc-300 text-[11px] uppercase font-bold tracking-wider";
const fieldClass = "bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-400 text-xs";

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The project to edit; null opens a blank form for a new one. */
  project: CodingProject | null;
  onSaved: () => void;
}

export default function ProjectFormDialog({ open, onOpenChange, project, onSaved }: ProjectFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-white">
            {project ? "Edit Project" : "New Coding Project"}
          </DialogTitle>
        </DialogHeader>
        {/* The popup unmounts while closed, so the form re-seeds from `project` on every open. */}
        <ProjectForm project={project} onCancel={() => onOpenChange(false)} onSaved={() => { onOpenChange(false); onSaved(); }} />
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({ project, onCancel, onSaved }: { project: CodingProject | null; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    githubUrl: project?.githubUrl ?? "",
    techStack: project?.techStack.join(", ") ?? "",
    status: (project?.status ?? "PLANNING") as ProjectStatus,
    roadmap: project?.roadmap ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const data = {
      name: form.name.trim(),
      description: form.description || undefined,
      githubUrl: form.githubUrl.trim() || undefined,
      techStack: form.techStack.split(",").map((t) => t.trim()).filter(Boolean),
      status: form.status,
      roadmap: form.roadmap || undefined,
    };
    setSaving(true);
    try {
      if (project) await updateCodingProject(project.id, data);
      else await createCodingProject(data);
      toast.success(project ? "Project updated." : `"${data.name}" created.`);
      onSaved();
    } catch {
      toast.error(project ? "Couldn't save the project. Nothing was changed." : "Couldn't create the project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-2">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1 col-span-2">
          <Label className={labelClass}>Project Name</Label>
          <Input autoFocus placeholder="e.g. DailyOS Productivity" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={fieldClass} required />
        </div>
        <div className="space-y-1">
          <Label className={labelClass}>Status</Label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
            className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white">
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className={labelClass}>Description</Label>
        <Textarea placeholder="What are you building?" value={form.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, description: e.target.value })}
          className={`${fieldClass} min-h-[60px]`} />
      </div>
      <div className="space-y-1">
        <Label className={labelClass}>GitHub URL</Label>
        <Input type="url" placeholder="https://github.com/..." value={form.githubUrl}
          onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
          className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label className={labelClass}>Tech Stack (comma separated)</Label>
        <Input placeholder="React, Node, Prisma, PostgreSQL" value={form.techStack}
          onChange={(e) => setForm({ ...form, techStack: e.target.value })}
          className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label className={labelClass}>Roadmap</Label>
        <Textarea placeholder={"- v0.1: auth and dashboard\n- v0.2: ..."} value={form.roadmap}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, roadmap: e.target.value })}
          className={`${fieldClass} min-h-[90px] font-mono`} />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
        <Button type="button" variant="outline" onClick={onCancel}
          className="border-zinc-800 text-zinc-300 text-xs h-8">Cancel</Button>
        <Button type="submit" disabled={saving} className="text-xs font-semibold h-8 px-4">
          {saving ? "Saving..." : project ? "Save Changes" : "Create Project"}
        </Button>
      </div>
    </form>
  );
}
