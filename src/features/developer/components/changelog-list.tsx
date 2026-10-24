"use client";

import React, { useState } from "react";
import { createChangelog, deleteChangelog } from "@/features/developer/actions";
import { Plus, Rocket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { Changelog, CodingProject } from "@/lib/types";
import { toast } from "@/stores/toast-store";

const labelClass = "text-zinc-300 text-[11px] uppercase font-bold tracking-wider";
const fieldClass = "bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-400 text-xs";

interface ChangelogListProps {
  project: CodingProject;
  onChanged: () => void;
}

export default function ChangelogList({ project, onChanged }: ChangelogListProps) {
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ version: "", title: "", description: "" });
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.version.trim() || !form.title.trim()) return;
    setSaving(true);
    try {
      await createChangelog(project.id, {
        version: form.version.trim(),
        title: form.title.trim(),
        description: form.description || undefined,
      });
      toast.success(`Release ${form.version.trim()} added.`);
      setForm({ version: "", title: "", description: "" });
      setShowForm(false);
      onChanged();
    } catch {
      toast.error("Couldn't add the release.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: Changelog) => {
    const ok = await confirm({
      title: `Delete release ${entry.version}?`,
      body: "Its release notes can't be recovered afterwards.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteChangelog(entry.id);
      toast.success(`Release ${entry.version} deleted.`);
      onChanged();
    } catch {
      toast.error("Couldn't delete the release.");
    }
  };

  return (
    <div className="space-y-3">
      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className={labelClass}>Version</Label>
              <Input autoFocus placeholder="e.g. 1.2.0" value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                className={`${fieldClass} font-mono`} required />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className={labelClass}>Title</Label>
              <Input placeholder="e.g. Offline mode" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={fieldClass} required />
            </div>
          </div>
          <Textarea placeholder={"What changed?\n- Added ...\n- Fixed ..."} value={form.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, description: e.target.value })}
            className={`${fieldClass} min-h-[80px] font-mono`} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}
              className="border-zinc-800 text-zinc-300 text-xs h-8">Cancel</Button>
            <Button type="submit" disabled={saving} className="text-xs font-semibold h-8 px-4">
              {saving ? "Saving..." : "Add Release"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1 text-xs font-semibold h-7">
            <Plus className="h-3.5 w-3.5" /> New Release
          </Button>
        </div>
      )}

      {project.changelogs.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-zinc-850 rounded-xl">
          <Rocket className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-xs text-zinc-400">No releases yet. Log one when you ship.</p>
        </div>
      ) : (
        // Newest first — the query orders changelogs by releasedAt desc.
        <div className="space-y-2">
          {project.changelogs.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/30 text-emerald-400 border border-emerald-900/40">
                  {entry.version}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-100">{entry.title}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {new Date(entry.releasedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
                <button onClick={() => handleDelete(entry)} aria-label={`Delete release ${entry.version}`}
                  className="text-zinc-400 hover:text-red-400 transition p-1 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {entry.description && (
                <p className="text-[11px] text-zinc-300 mt-2 leading-relaxed whitespace-pre-wrap">{entry.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
