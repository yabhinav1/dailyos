"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getCodingProjects, createCodingProject, getSnippets, createSnippet, deleteSnippet } from "@/features/developer/actions";
import { Code, Terminal, Plus, Folder, Copy, Check, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonCards } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/utils";
import type { CodingProject, CodeSnippet } from "@/lib/types";

export default function DeveloperPage() {
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

  // Form State
  const [projForm, setProjForm] = useState({ name: "", description: "", githubUrl: "", techStack: "", status: "PLANNING" as const });
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
    (async () => {
      setLoading(true);
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

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projForm.name.trim()) return;
    const techs = projForm.techStack.split(",").map(t => t.trim()).filter(Boolean);
    await createCodingProject({
      name: projForm.name,
      description: projForm.description || undefined,
      githubUrl: projForm.githubUrl || undefined,
      techStack: techs,
      status: projForm.status,
    });
    setProjForm({ name: "", description: "", githubUrl: "", techStack: "", status: "PLANNING" });
    setShowProjDialog(false);
    reloadData();
  };

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
    if (!confirm("Are you sure you want to delete this snippet?")) return;
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
          <p className="text-xs text-zinc-400 mt-1">Manage project roadmaps and save reusable code snippets.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "projects" ? (
            <Button size="sm" onClick={() => setShowProjDialog(true)}
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
          className={`px-3 py-2 text-[11px] font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === "projects" ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Folder className="h-3.5 w-3.5" /> Projects
        </button>
        <button
          onClick={() => setActiveTab("snippets")}
          className={`px-3 py-2 text-[11px] font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === "snippets" ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Code className="h-3.5 w-3.5" /> Snippets
        </button>
        <button
          onClick={() => setActiveTab("playground")}
          className={`px-3 py-2 text-[11px] font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === "playground" ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
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
              <Terminal className="h-4 w-4 text-zinc-400" /> HTTP API Request Playground
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
              <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Response Data</label>
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
            <p className="text-sm font-semibold text-zinc-400">No coding projects yet</p>
            <p className="text-xs text-zinc-500 mt-1">Add your development project to start tracking your tech stack and issues.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="border-zinc-850 bg-[#0C0C0E]/40 hover:border-zinc-800 transition-all">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        {project.name}
                        <span className="text-[9px] px-1.5 py-0.5 bg-zinc-900 text-zinc-400 rounded-full">{project.status}</span>
                      </h3>
                      {project.description && <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">{project.description}</p>}
                    </div>
                    {project.githubUrl && (
                      <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  {project.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.techStack.map((tech: string) => (
                        <span key={tech} className="text-[9px] px-2 py-0.5 bg-blue-950/20 text-blue-400 border border-blue-900/30 rounded">{tech}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-[10px] text-zinc-500 border-t border-zinc-900/60 pt-3">
                    <span>{project.issues.length} Issues</span>
                    <span>{project.changelogs.length} Releases</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : snippets.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-850 rounded-xl">
          <Code className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-400">No code snippets saved</p>
          <p className="text-xs text-zinc-500 mt-1">Save syntax structures, boilerplate classes, and snippets.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {snippets.map((snip) => (
            <Card key={snip.id} className="border-zinc-850 bg-[#0C0C0E]/40 hover:border-zinc-800 transition-all">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200">{snip.title}</h3>
                    {snip.description && <p className="text-[10px] text-zinc-500 mt-0.5">{snip.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => copyToClipboard(snip.id, snip.code)} className="text-zinc-500 hover:text-white transition p-1">
                      {copiedId === snip.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => handleDeleteSnippet(snip.id)} className="text-zinc-500 hover:text-red-400 transition p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto whitespace-pre">
                  <code>{snip.code}</code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Project Form Dialog */}
      <Dialog open={showProjDialog} onOpenChange={setShowProjDialog}>
        <DialogContent className="max-w-sm bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader><DialogTitle className="text-sm font-bold text-white">New Coding Project</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Project Name</Label>
              <Input autoFocus placeholder="e.g. DailyOS Productivity" value={projForm.name}
                onChange={(e) => setProjForm({ ...projForm, name: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500 text-xs" required />
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Description</Label>
              <Textarea placeholder="What are you building?" value={projForm.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProjForm({ ...projForm, description: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500 text-xs min-h-[60px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">GitHub URL</Label>
              <Input placeholder="https://github.com/..." value={projForm.githubUrl}
                onChange={(e) => setProjForm({ ...projForm, githubUrl: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Tech Stack (comma separated)</Label>
              <Input placeholder="React, Node, Prisma, PostgreSQL" value={projForm.techStack}
                onChange={(e) => setProjForm({ ...projForm, techStack: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500 text-xs" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button type="button" variant="outline" onClick={() => setShowProjDialog(false)}
                className="border-zinc-800 text-zinc-400 text-xs h-8">Cancel</Button>
              <Button type="submit" className="text-xs font-semibold h-8 px-4">Create Project</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Snippet Form Dialog */}
      <Dialog open={showSnipDialog} onOpenChange={setShowSnipDialog}>
        <DialogContent className="max-w-md bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader><DialogTitle className="text-sm font-bold text-white">Save Code Snippet</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateSnippet} className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Snippet Title</Label>
                <Input autoFocus placeholder="e.g. Next.js Prisma init" value={snipForm.title}
                  onChange={(e) => setSnipForm({ ...snipForm, title: e.target.value })}
                  className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500 text-xs" required />
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Language</Label>
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
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Description</Label>
              <Input placeholder="Quick description of what this does" value={snipForm.description}
                onChange={(e) => setSnipForm({ ...snipForm, description: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Code Block</Label>
              <Textarea placeholder="Paste code here..." value={snipForm.code}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSnipForm({ ...snipForm, code: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-500 text-xs min-h-[140px] font-mono" required />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button type="button" variant="outline" onClick={() => setShowSnipDialog(false)}
                className="border-zinc-800 text-zinc-400 text-xs h-8">Cancel</Button>
              <Button type="submit" className="text-xs font-semibold h-8 px-4">Save Snippet</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
