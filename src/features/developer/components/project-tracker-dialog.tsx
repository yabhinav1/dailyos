"use client";

import React, { useState } from "react";
import { Bug, Map as MapIcon, Rocket } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CodingProject, DeveloperIssue } from "@/lib/types";
import IssueList from "./issue-list";
import ChangelogList from "./changelog-list";

interface ProjectTrackerDialogProps {
  project: CodingProject | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  onPatchIssue: (issueId: string, patch: Partial<DeveloperIssue>) => void;
}

/** Issues, releases and roadmap for one coding project. */
export default function ProjectTrackerDialog({ project, open, onOpenChange, onChanged, onPatchIssue }: ProjectTrackerDialogProps) {
  return (
    <Dialog open={open && !!project} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
        {project && <TrackerBody project={project} onChanged={onChanged} onPatchIssue={onPatchIssue} />}
      </DialogContent>
    </Dialog>
  );
}

type Tab = "issues" | "releases" | "roadmap";

function TrackerBody({ project, onChanged, onPatchIssue }: {
  project: CodingProject;
  onChanged: () => void;
  onPatchIssue: (issueId: string, patch: Partial<DeveloperIssue>) => void;
}) {
  const [tab, setTab] = useState<Tab>("issues");
  const openCount = project.issues.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS").length;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "issues", label: `Issues (${openCount} open)`, icon: Bug },
    { id: "releases", label: `Releases (${project.changelogs.length})`, icon: Rocket },
    { id: "roadmap", label: "Roadmap", icon: MapIcon },
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
          {project.name}
          <span className="text-[11px] px-1.5 py-0.5 bg-zinc-900 text-zinc-300 rounded-full font-semibold">{project.status}</span>
        </DialogTitle>
      </DialogHeader>

      <div className="flex items-center gap-1 border-b border-zinc-900">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              tab === id ? "border-white text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {tab === "issues" ? (
          <IssueList project={project} onChanged={onChanged} onPatchIssue={onPatchIssue} />
        ) : tab === "releases" ? (
          <ChangelogList project={project} onChanged={onChanged} />
        ) : project.roadmap ? (
          <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-900 font-mono text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {project.roadmap}
          </pre>
        ) : (
          <p className="py-10 text-center text-xs text-zinc-400">No roadmap yet. Add one by editing the project.</p>
        )}
      </div>
    </>
  );
}
