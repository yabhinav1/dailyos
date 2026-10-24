"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getCodingProjects, deleteCodingProject, getSnippets, createSnippet, deleteSnippet } from "@/features/developer/actions";
import { Code, Terminal, Plus, Folder, Copy, Check, Trash2, ExternalLink, Pencil, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonCards } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/utils";
import type { CodingProject, CodeSnippet, DeveloperIssue } from "@/lib/types";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/stores/toast-store";
import ProjectFormDialog from "@/features/developer/components/project-form-dialog";
import ProjectTrackerDialog from "@/features/developer/components/project-tracker-dialog";

export default function DeveloperPage() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<"projects" | "snippets" | "playground">("projects");
  const [projects, setProjects] = useState<CodingProject[]>([]);
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // API Playground State
  const [apiUrl, setApiUrl] = useState("https://jsonplaceholder.typicode.com/todos/1");
  const [apiMethod, setApiMethod] = useState<"GET" | "POST">("GET");
  const [apiResult, setApiResult] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<string | null>(null);
  const [apiTesting, setApiTesting] = useState(false);

  // Dialog state
  const [showProjDialog, setShowProjDialog] = useState(false);
  const [showSnipDialog, setShowSnipDialog] = useState(false);
  // Kept after the dialog closes so its title doesn't flip mid-animation.
  const [editingProject, setEditingProject] = useState<CodingProject | null>(null);
  // Looked up by id so the tracker always shows the latest fetched project.
  const [trackerId, setTrackerId] = useState<string | null>(null);
  const [trackerOpen, setTrackerOpen] = useState(false);

  // Form State
  const [snipForm, setSnipForm] = useState({ title: "", description: "", code: "", language: "javascript" });
  const handleTestApi = async () => {
    if (!apiUrl.trim()) return;
    setApiTesting(true);
    setApiResult(null);
    setApiStatus(null);
    const startTime = Date.now();
    try {
      const res = await fetch(apiUrl, { method: apiMethod });
      const elapsed = Date.now() - startTime;
      const text = await res.text();
      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // response body was not JSON — show it raw
      }
      setApiStatus(`${res.status} ${res.statusText} • ${elapsed}ms`);
      setApiResult(formatted);
    } catch (err: unknown) {
      setApiStatus("Error: Request Failed");
      setApiResult(getErrorMessage(err, "Failed to execute request"));
    } finally {
      setApiTesting(false);
    }
  };

  const [reloadToken, setReloadToken] = useState(0);
  const reloadData = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    // Only the first load shows skeletons (loading starts true). Later reloads
    // swap data in place, so the tracker dialog and scroll position survive.
    (async () => {
      const [pRes, sRes] = await Promise.all([getCodingProjects(), getSnippets()]);
      if (cancelled) return;
      if (pRes.success && pRes.data) setProjects(pRes.data);
      if (sRes.success && sRes.data) setSnippets(sRes.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const openProjectForm = (project: CodingProject | null) => {
    setEditingProject(project);
    setShowProjDialog(true);
  };

  const openTracker = (projectId: string) => {
    setTrackerId(projectId);
    setTrackerOpen(true);
  };

  const handleDeleteProject = async (project: CodingProject) => {
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      body: "Its issues and release notes go with it. This can't be undone.",
      confirmLabel: "Delete project",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCodingProject(project.id);
      if (trackerId === project.id) setTrackerOpen(false);
      toast.success(`"${project.name}" deleted.`);
      reloadData();
    } catch {
      toast.error("Couldn't delete the project.");
    }
  };

  // Local-only patch for optimistic issue edits; the reload that follows
  // replaces it with what the server saved.
  const patchIssue = useCallback((issueId: string, patch: Partial<DeveloperIssue>) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.issues.some((i) => i.id === issueId)
          ? { ...p, issues: p.issues.map((i) => (i.id === issueId ? { ...i, ...patch } : i)) }
          : p
      )
    );
  }, []);

  const handleCreateSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snipForm.title.trim() || !snipForm.code.trim()) return;
    await createSnippet({
      title: snipForm.title,
      description: snipForm.description || undefined,
      code: snipForm.code,
      language: snipForm.language,
    });
    setSnipForm({ title: "", description: "", code: "", language: "javascript" });
    setShowSnipDialog(false);
    reloadData();
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDeleteSnippet = async (id: string) => {
    const ok = await confirm({
      title: "Delete this snippet?",
      body: "It can't be recovered afterwards.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await deleteSnippet(id);
    reloadData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Terminal className="h-5.5 w-5.5 text-blue-400" /> Developer Mode
          </h1>
          <p className="text-xs text-zinc-300 mt-1">Manage project roadmaps and save reusable code snippets.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "projects" ? (
            <Button size="sm" onClick={() => openProjectForm(null)}
              className="gap-1 text-xs font-semibold h-8 shrink-0">
              <Plus className="h-3.5 w-3.5" /> New Project
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowSnipDialog(true)}
              className="gap-1 text-xs font-semibold h-8 shrink-0">
              <Plus className="h-3.5 w-3.5" /> New Snippet
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-900 pb-0">
        <button
          onClick={() => setActiveTab("projects")}
          className={`px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === "projects" ? "border-white text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Folder className="h-3.5 w-3.5" /> Projects
        </button>
        <button
          onClick={() => setActiveTab("snippets")}
          className={`px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === "snippets" ? "border-white text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Code className="h-3.5 w-3.5" /> Snippets
        </button>
        <button
          onClick={() => setActiveTab("playground")}
          className={`px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === "playground" ? "border-white text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Terminal className="h-3.5 w-3.5" /> API Tester
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonCards cards={3} />
      ) : activeTab === "playground" ? (
        <div className="space-y-4 p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="h-4 w-4 text-zinc-300" /> HTTP API Request Playground
            </h2>
            {apiStatus && <span className="text-xs font-mono text-emerald-400">{apiStatus}</span>}
          </div>
          <div className="flex gap-2">
            <select
              value={apiMethod}
              onChange={(e) => setApiMethod(e.target.value as "GET" | "POST")}
              className="h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-bold text-white"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
            <Input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.example.com/data"
              className="flex-1 h-9 bg-zinc-900 border-zinc-800 text-xs text-white"
            />
            <Button size="sm" onClick={handleTestApi} disabled={apiTesting} className="h-9 text-xs font-semibold px-4">
              {apiTesting ? "Sending..." : "Send"}
            </Button>
          </div>
          {apiResult && (
            <div className="space-y-1 pt-2">
              <label className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Response Data</label>
              <pre className="p-4 rounded-lg bg-[#0a0a0c] border border-zinc-850 font-mono text-xs text-zinc-200 overflow-x-auto max-h-96 leading-relaxed select-all">
                {apiResult}
              </pre>
            </div>
          )}
        </div>
      ) : activeTab === "projects" ? (
        projects.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-zinc-850 rounded-xl">
            <Folder className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-300">No coding projects yet</p>
            <p className="text-xs text-zinc-400 mt-1">Add your development project to start tracking your tech stack and issues.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="border-zinc-850 bg-[#0C0C0E]/40 hover:border-zinc-800 transition-all">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        {project.name}
                        <span className="text-[11px] px-1.5 py-0.5 bg-zinc-900 text-zinc-300 rounded-full">{project.status}</span>
                      </h3>
                      {project.description && <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{project.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {project.githubUrl && (
                        <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" aria-label="Open repository"
                          className="text-zinc-400 hover:text-white transition p-1">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button onClick={() => openProjectForm(project)} aria-label={`Edit ${project.name}`}
                        className="text-zinc-400 hover:text-white transition p-1">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDeleteProject(project)} aria-label={`Delete ${project.name}`}
                        className="text-zinc-400 hover:text-red-400 transition p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {project.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.techStack.map((tech: string) => (
                        <span key={tech} className="text-[11px] px-2 py-0.5 bg-blue-950/20 text-blue-400 border border-blue-900/30 rounded">{tech}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-[11px] text-zinc-400 border-t border-zinc-900/60 pt-3">
                    <span>{project.issues.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS").length} Open Issues</span>
                    <span>
                      {project.changelogs.length} Releases
                      {/* changelogs arrive newest first */}
                      {project.changelogs[0] && <span className="font-mono text-zinc-300"> · {project.changelogs[0].version}</span>}
                    </span>
                    <button onClick={() => openTracker(project.id)}
                      className="ml-auto flex items-center gap-1 font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                      <ListChecks className="h-3.5 w-3.5" /> Issues & Releases
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : snippets.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-850 rounded-xl">
          <Code className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-300">No code snippets saved</p>
          <p className="text-xs text-zinc-400 mt-1">Save syntax structures, boilerplate classes, and snippets.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {snippets.map((snip) => (
            <Card key={snip.id} className="border-zinc-850 bg-[#0C0C0E]/40 hover:border-zinc-800 transition-all">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200">{snip.title}</h3>
                    {snip.description && <p className="text-[11px] text-zinc-400 mt-0.5">{snip.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => copyToClipboard(snip.id, snip.code)} className="text-zinc-400 hover:text-white transition p-1">
                      {copiedId === snip.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => handleDeleteSnippet(snip.id)} className="text-zinc-400 hover:text-red-400 transition p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-3 font-mono text-xs text-zinc-200 overflow-x-auto whitespace-pre">
                  <code>{snip.code}</code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProjectFormDialog open={showProjDialog} onOpenChange={setShowProjDialog}
        project={editingProject} onSaved={reloadData} />

      <ProjectTrackerDialog
        project={projects.find((p) => p.id === trackerId)}
        open={trackerOpen}
        onOpenChange={setTrackerOpen}
        onChanged={reloadData}
        onPatchIssue={patchIssue}
      />

      {/* Snippet Form Dialog */}
      <Dialog open={showSnipDialog} onOpenChange={setShowSnipDialog}>
        <DialogContent className="max-w-md bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader><DialogTitle className="text-sm font-bold text-white">Save Code Snippet</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateSnippet} className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Snippet Title</Label>
                <Input autoFocus placeholder="e.g. Next.js Prisma init" value={snipForm.title}
                  onChange={(e) => setSnipForm({ ...snipForm, title: e.target.value })}
                  className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-400 text-xs" required />
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Language</Label>
                <select value={snipForm.language} onChange={(e) => setSnipForm({ ...snipForm, language: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white">
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="sql">SQL</option>
                  <option value="css">CSS</option>
                  <option value="html">HTML</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Description</Label>
              <Input placeholder="Quick description of what this does" value={snipForm.description}
                onChange={(e) => setSnipForm({ ...snipForm, description: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-400 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Code Block</Label>
              <Textarea placeholder="Paste code here..." value={snipForm.code}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSnipForm({ ...snipForm, code: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-400 text-xs min-h-[140px] font-mono" required />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button type="button" variant="outline" onClick={() => setShowSnipDialog(false)}
                className="border-zinc-800 text-zinc-300 text-xs h-8">Cancel</Button>
              <Button type="submit" className="text-xs font-semibold h-8 px-4">Save Snippet</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
