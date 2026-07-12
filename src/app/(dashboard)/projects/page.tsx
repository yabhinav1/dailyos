"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getProjectsAction,
  createProject,
  deleteProject,
  toggleProjectCompleted,
} from "@/features/projects/actions";
import { createResource, deleteResource, getResourcesForProject, uploadProjectFile } from "@/features/projects/actions";
import {
  FolderKanban, Plus, Trash2, CheckCircle2, Circle, Calendar, MoreVertical, Edit,
  Paperclip, FileText, Image as ImageIcon, Download, X, Upload, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader } from "@/components/ui/loader";

// Keep in sync with MAX_UPLOAD_BYTES in src/features/projects/actions.ts.
const MAX_UPLOAD_MB = 50;

function ProjectProgress({ progress }: { progress: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">Progress</span>
        <span className="text-[10px] font-semibold text-zinc-300">{progress}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-900">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            progress === 100
              ? "bg-emerald-500"
              : progress > 50
              ? "bg-blue-500"
              : "bg-amber-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function CreateProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createProject({ name, description: description || undefined, deadline: deadline || null });
      setName(""); setDescription(""); setDeadline("");
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-white">New Project Workspace</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">{error}</div>
          )}
          <div className="space-y-1">
            <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Project Name</Label>
            <Input
              placeholder="e.g. Portfolio Website"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-500 text-xs"
              required disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Description</Label>
            <Textarea
              placeholder="What is this project about?"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white placeholder-zinc-500 text-xs min-h-[70px]"
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Deadline (optional)</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-zinc-900/50 border-zinc-800 focus:border-zinc-700 text-white text-xs h-9"
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-900">
            <Button type="button" variant="outline" onClick={onClose}
              className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 text-xs h-9" disabled={loading}>
              Cancel
            </Button>
            <Button type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold h-9" disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectFilesDialog({
  project,
  onClose,
}: {
  project: any | null;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    const res = await getResourcesForProject(project.id);
    if (res.success && res.data) setFiles(res.data);
    setLoading(false);
  }, [project]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0 || !project) return;
    setError(null);
    setUploading(true);
    for (const file of Array.from(selected)) {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setError(`"${file.name}" is over ${MAX_UPLOAD_MB}MB — please upload a smaller file.`);
        continue;
      }
      const fd = new FormData();
      fd.set("file", file);
      fd.set("projectId", project.id);
      fd.set("title", file.name);
      const res = await uploadProjectFile(fd);
      if (!res.success) setError(res.message || "Upload failed");
    }
    setUploading(false);
    fetchFiles();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this file?")) return;
    const res = await deleteResource(id);
    if (!res.success) setError(res.message || "Failed to delete file");
    fetchFiles();
  };

  const isImage = (mime?: string | null) => !!mime && mime.startsWith("image/");
  const isPdf = (mime?: string | null) => mime === "application/pdf";
  const fileHref = (f: any) => (f.type === "FILE" ? `/api/files/${f.id}` : f.url);

  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Files — {project?.name}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}><X className="h-3 w-3" /></button>
          </div>
        )}

        <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 hover:border-zinc-600 py-6 text-xs text-zinc-400 cursor-pointer transition-colors">
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading..." : `Click to upload PDFs, images, or any file (max ${MAX_UPLOAD_MB}MB each)`}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>

        <div className="max-h-72 overflow-y-auto space-y-1.5 pt-1">
          {loading ? (
            <div className="py-6 text-center"><Loader /></div>
          ) : files.length === 0 ? (
            <p className="text-center text-[11px] text-zinc-600 py-4">No files uploaded yet.</p>
          ) : (
            files.map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                {isImage(f.mimeType) ? (
                  <img src={fileHref(f)} alt={f.title} className="h-8 w-8 rounded object-cover shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-zinc-500 shrink-0" />
                )}
                <span className="flex-1 truncate text-[11px] text-zinc-300">{f.title}</span>
                <a
                  href={fileHref(f)}
                  download={f.title}
                  target={isImage(f.mimeType) || isPdf(f.mimeType) ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-blue-400 transition-colors"
                  title={isPdf(f.mimeType) ? "Open PDF" : isImage(f.mimeType) ? "Open image" : "Download"}
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button onClick={() => handleDelete(f.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-zinc-900">
          <Button type="button" variant="outline" onClick={onClose} className="border-zinc-800 text-zinc-400 text-xs h-8">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [filesProject, setFilesProject] = useState<any | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const res = await getProjectsAction();
    if (res.success && res.data) setProjects(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const filtered = projects.filter((p) => {
    if (filter === "active") return !p.isCompleted;
    if (filter === "completed") return p.isCompleted;
    return true;
  });

  const handleDelete = async (projectId: string, name: string) => {
    if (!confirm(`Delete project "${name}"? All tasks in it will remain.`)) return;
    await deleteProject(projectId);
    fetchProjects();
  };

  const handleToggleComplete = async (projectId: string, current: boolean) => {
    await toggleProjectCompleted(projectId, !current);
    fetchProjects();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FolderKanban className="h-5.5 w-5.5 text-violet-400" />
            Projects
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Organize your work into focused project workspaces</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white gap-1 text-xs font-semibold h-8 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> New Project
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-900 pb-0">
        {(["all", "active", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 text-[11px] font-semibold capitalize transition-colors border-b-2 -mb-px ${
              filter === f
                ? "border-blue-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-24 text-center">
          <Loader />
          <p className="text-[11px] text-zinc-500 mt-2">Loading projects...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-850 rounded-xl">
          <FolderKanban className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-400">No projects yet</p>
          <p className="text-xs text-zinc-500 mt-1">Create your first project workspace to get started</p>
          <Button size="sm" onClick={() => setShowCreate(true)} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1">
            <Plus className="h-3.5 w-3.5" /> New Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <Card
              key={project.id}
              className={`group border-zinc-850 bg-[#0C0C0E]/40 hover:border-zinc-800 hover:bg-zinc-950/60 transition-all duration-200 shadow-sm ${
                project.isCompleted ? "opacity-60" : ""
              }`}
            >
              <CardContent className="p-5 space-y-4">
                {/* Title Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={() => handleToggleComplete(project.id, project.isCompleted)}
                      className="shrink-0 text-zinc-600 hover:text-emerald-500 transition-colors"
                    >
                      {project.isCompleted
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        : <Circle className="h-5 w-5" />}
                    </button>
                    <h3 className={`text-sm font-semibold text-zinc-100 truncate ${project.isCompleted ? "line-through text-zinc-500" : ""}`}>
                      {project.name}
                    </h3>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 p-1 transition-opacity focus:outline-none cursor-pointer">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#171717] border border-zinc-800 text-zinc-400 text-xs">
                      <DropdownMenuItem
                        onClick={() => setFilesProject(project)}
                        className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer flex items-center gap-2"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Files
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleComplete(project.id, project.isCompleted)}
                        className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer flex items-center gap-2"
                      >
                        {project.isCompleted ? <Circle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {project.isCompleted ? "Mark Active" : "Mark Complete"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(project.id, project.name)}
                        className="text-red-500 hover:bg-zinc-900 focus:bg-red-950/20 focus:text-red-400 cursor-pointer flex items-center gap-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Description */}
                {project.description && (
                  <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                    {project.description}
                  </p>
                )}

                {/* Progress Bar */}
                <ProjectProgress progress={project.progress} />

                {/* Footer Stats */}
                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-900/60">
                  <span>{project.completedTasks}/{project.totalTasks} tasks done</span>
                  {project.deadline && (
                    <span className={`flex items-center gap-1 ${new Date(project.deadline) < new Date() && !project.isCompleted ? "text-red-400" : ""}`}>
                      <Calendar className="h-3 w-3" />
                      {new Date(project.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateProjectDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchProjects} />
      <ProjectFilesDialog project={filesProject} onClose={() => setFilesProject(null)} />
    </div>
  );
}
