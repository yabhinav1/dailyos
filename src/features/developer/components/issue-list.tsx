"use client";

import React, { useState } from "react";
import { createIssue, updateIssue, deleteIssue } from "@/features/developer/actions";
import { Bug, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { CodingProject, DeveloperIssue } from "@/lib/types";
import { toast } from "@/stores/toast-store";

const ISSUE_TYPES = ["BUG", "FEATURE", "CHORE"] as const;
const ISSUE_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const ISSUE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
type IssueType = (typeof ISSUE_TYPES)[number];
type IssueStatus = (typeof ISSUE_STATUSES)[number];
type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

// The columns are plain strings, so lookups fall back rather than trusting the value.
const TYPE_STYLES: Record<string, string> = {
  BUG: "bg-red-950/30 text-red-400 border-red-900/40",
  FEATURE: "bg-blue-950/20 text-blue-400 border-blue-900/30",
  CHORE: "bg-zinc-900 text-zinc-300 border-zinc-800",
};
const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-amber-400",
  MEDIUM: "text-zinc-300",
  LOW: "text-zinc-400",
};

const isDone = (status: string) => status === "RESOLVED" || status === "CLOSED";
const humanize = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace("_", " ");

const labelClass = "text-zinc-300 text-[11px] uppercase font-bold tracking-wider";
const fieldClass = "bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-400 text-xs";
const selectClass = "w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white";

interface IssueListProps {
  project: CodingProject;
  onChanged: () => void;
  /** Applies a change locally before the server confirms it. */
  onPatchIssue: (issueId: string, patch: Partial<DeveloperIssue>) => void;
}

export default function IssueList({ project, onChanged, onPatchIssue }: IssueListProps) {
  const confirm = useConfirm();
  // "new" for the create form, an issue for the edit form, null for neither.
  const [editing, setEditing] = useState<DeveloperIssue | "new" | null>(null);
  const [showDone, setShowDone] = useState(false);

  const doneCount = project.issues.filter((i) => isDone(i.status)).length;
  const visible = showDone ? project.issues : project.issues.filter((i) => !isDone(i.status));

  // Optimistic: the select moves immediately; on failure it snaps back.
  const handleStatusChange = async (issue: DeveloperIssue, status: IssueStatus) => {
    onPatchIssue(issue.id, { status });
    try {
      await updateIssue(issue.id, { status });
      onChanged();
    } catch {
      onPatchIssue(issue.id, { status: issue.status });
      toast.error("Couldn't update the issue. Nothing was changed.");
    }
  };

  const handleDelete = async (issue: DeveloperIssue) => {
    const ok = await confirm({
      title: `Delete "${issue.title}"?`,
      body: "It can't be recovered afterwards.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteIssue(issue.id);
      if (editing !== "new" && editing?.id === issue.id) setEditing(null);
      toast.success("Issue deleted.");
      onChanged();
    } catch {
      toast.error("Couldn't delete the issue.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowDone(!showDone)}
          disabled={doneCount === 0}
          className="text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
        >
          {showDone ? "Hide" : "Show"} resolved & closed ({doneCount})
        </button>
        {editing === null && (
          <Button size="sm" onClick={() => setEditing("new")} className="gap-1 text-xs font-semibold h-7">
            <Plus className="h-3.5 w-3.5" /> New Issue
          </Button>
        )}
      </div>

      {editing !== null && (
        <IssueForm
          key={editing === "new" ? "new" : editing.id}
          projectId={project.id}
          issue={editing === "new" ? null : editing}
          onDone={() => { setEditing(null); onChanged(); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {visible.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-zinc-850 rounded-xl">
          <Bug className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-xs text-zinc-400">
            {project.issues.length === 0 ? "No issues logged for this project." : "Nothing open — every issue is resolved or closed."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {visible.map((issue) => (
            <div key={issue.id} className="flex items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
              <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_STYLES[issue.type] ?? TYPE_STYLES.CHORE}`}>
                {issue.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${isDone(issue.status) ? "line-through text-zinc-400" : "text-zinc-100"}`}>
                  {issue.title}
                </p>
                {issue.description && (
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed whitespace-pre-wrap line-clamp-3">{issue.description}</p>
                )}
                <p className="text-[11px] mt-1">
                  <span className={PRIORITY_STYLES[issue.priority] ?? "text-zinc-300"}>{humanize(issue.priority)} priority</span>
                  <span className="text-zinc-500"> · opened {new Date(issue.createdAt).toLocaleDateString()}</span>
                </p>
              </div>
              <select
                value={issue.status}
                onChange={(e) => handleStatusChange(issue, e.target.value as IssueStatus)}
                aria-label={`Status of ${issue.title}`}
                className="h-7 shrink-0 px-2 rounded-md border border-zinc-800 bg-[#1f1f1f] text-[11px] text-white"
              >
                {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </select>
              <button onClick={() => setEditing(issue)} aria-label={`Edit ${issue.title}`}
                className="text-zinc-400 hover:text-white transition p-1 shrink-0">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(issue)} aria-label={`Delete ${issue.title}`}
                className="text-zinc-400 hover:text-red-400 transition p-1 shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IssueForm({ projectId, issue, onDone, onCancel }: {
  projectId: string;
  issue: DeveloperIssue | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: issue?.title ?? "",
    description: issue?.description ?? "",
    type: (issue?.type ?? "BUG") as IssueType,
    status: (issue?.status ?? "OPEN") as IssueStatus,
    priority: (issue?.priority ?? "MEDIUM") as IssuePriority,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const data = { ...form, title: form.title.trim() };
    setSaving(true);
    try {
      if (issue) await updateIssue(issue.id, data);
      else await createIssue(projectId, { ...data, description: data.description || undefined });
      toast.success(issue ? "Issue updated." : "Issue logged.");
      onDone();
    } catch {
      toast.error(issue ? "Couldn't save the issue. Nothing was changed." : "Couldn't log the issue.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="space-y-1">
        <Label className={labelClass}>{issue ? "Edit Issue" : "New Issue"}</Label>
        <Input autoFocus placeholder="e.g. Login redirect loops on Safari" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className={fieldClass} required />
      </div>
      <Textarea placeholder="Steps to reproduce, context, links..." value={form.description}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, description: e.target.value })}
        className={`${fieldClass} min-h-[60px]`} />
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className={labelClass}>Type</Label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as IssueType })} className={selectClass}>
            {ISSUE_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className={labelClass}>Priority</Label>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as IssuePriority })} className={selectClass}>
            {ISSUE_PRIORITIES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className={labelClass}>Status</Label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as IssueStatus })} className={selectClass}>
            {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}
          className="border-zinc-800 text-zinc-300 text-xs h-8">Cancel</Button>
        <Button type="submit" disabled={saving} className="text-xs font-semibold h-8 px-4">
          {saving ? "Saving..." : issue ? "Save Issue" : "Log Issue"}
        </Button>
      </div>
    </form>
  );
}
