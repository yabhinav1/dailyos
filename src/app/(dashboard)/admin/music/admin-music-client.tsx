"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  listLavalinkNodes,
  addLavalinkNode,
  updateLavalinkNode,
  removeLavalinkNode,
  testLavalinkNode,
} from "@/features/music/admin-actions";
import {
  Server,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Circle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface NodeRow {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  enabled: boolean;
  priority: number;
  status: string;
  lastError: string | null;
  lastCheckedAt: string | Date | null;
}

function StatusBadge({ status, lastError }: { status: string; lastError: string | null }) {
  const map: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
    ONLINE: { icon: <CheckCircle2 className="h-3 w-3" />, cls: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", label: "Online" },
    OFFLINE: { icon: <XCircle className="h-3 w-3" />, cls: "text-red-500 bg-red-500/10 border-red-500/20", label: "Offline" },
    ERROR: { icon: <AlertTriangle className="h-3 w-3" />, cls: "text-amber-500 bg-amber-500/10 border-amber-500/20", label: "Error" },
    UNKNOWN: { icon: <Circle className="h-3 w-3" />, cls: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20", label: "Unknown" },
  };
  const s = map[status] || map.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`} title={lastError || undefined}>
      {s.icon}
      {s.label}
    </span>
  );
}

export default function AdminMusicClient() {
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    host: "",
    port: "2333",
    password: "",
    secure: false,
    priority: "0",
  });

  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await listLavalinkNodes();
      if (cancelled) return;
      if (res.success) setNodes(res.data as NodeRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const port = parseInt(form.port, 10);
    const priority = parseInt(form.priority, 10) || 0;

    if (!form.name.trim() || !form.host.trim() || !form.password) {
      setFormError("Name, host, and password are required.");
      return;
    }

    setSubmitting(true);
    const res = await addLavalinkNode({
      name: form.name.trim(),
      host: form.host.trim(),
      port,
      password: form.password,
      secure: form.secure,
      priority,
    });
    setSubmitting(false);

    if (!res.success) {
      setFormError(res.message || "Failed to add node.");
      return;
    }

    setForm({ name: "", host: "", port: "2333", password: "", secure: false, priority: "0" });
    setFormOpen(false);
    reload();
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this Lavalink node? This can't be undone.")) return;
    await removeLavalinkNode(id);
    reload();
  };

  const handleToggleEnabled = async (node: NodeRow) => {
    await updateLavalinkNode(node.id, { enabled: !node.enabled });
    reload();
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    await testLavalinkNode(id);
    setTestingId(null);
    reload();
  };

  const sortedNodes = [...nodes].sort((a, b) => a.priority - b.priority);
  const activeNode = sortedNodes.find((n) => n.enabled && n.status === "ONLINE");

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-500">
          <Server className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Lavalink Nodes</h1>
          <p className="text-xs text-zinc-400">Manage playback nodes for the music player. Lower priority is tried first; a down node fails over automatically.</p>
        </div>
      </div>

      {/* Active node summary */}
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0" />
        <p className="text-xs text-zinc-400 dark:text-zinc-300">
          {activeNode ? (
            <>Currently routing playback through <span className="font-semibold text-zinc-900 dark:text-white">{activeNode.name}</span>.</>
          ) : (
            "No node is currently confirmed online — the player will fall back to locally uploaded tracks."
          )}
        </p>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={reload} className="h-7 gap-1.5 text-xs text-zinc-400">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button size="sm" onClick={() => setFormOpen((v) => !v)} className="h-7 gap-1.5 text-xs bg-blue-600 hover:bg-blue-500">
          <Plus className="h-3.5 w-3.5" />
          Add node
        </Button>
      </div>

      {formOpen && (
        <Card className="mb-4 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717]">
          <CardContent className="p-4">
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Primary (US-East)" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Priority</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} placeholder="0" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Host</Label>
                <Input value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} placeholder="lavalink.example.com" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Port</Label>
                <Input type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} placeholder="2333" className="h-8 text-xs" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs text-zinc-400">Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Node authorization password" className="h-8 text-xs" autoComplete="new-password" />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={form.secure} onChange={(e) => setForm((f) => ({ ...f, secure: e.target.checked }))} className="h-3.5 w-3.5" />
                Use secure connection (https/wss)
              </label>

              {formError && <p className="col-span-2 text-xs text-red-500">{formError}</p>}

              <div className="col-span-2 flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)} className="h-7 text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting} className="h-7 gap-1.5 text-xs bg-blue-600 hover:bg-blue-500">
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Add & verify
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {loading && nodes.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-400">Loading nodes…</p>
        ) : nodes.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-400">No nodes configured yet. Add one above.</p>
        ) : (
          sortedNodes.map((node) => (
            <div
              key={node.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                node.enabled ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717]" : "border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950/40 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 rounded bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 text-[11px] font-mono text-zinc-400">#{node.priority}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-semibold text-zinc-900 dark:text-white">{node.name}</p>
                    <StatusBadge status={node.status} lastError={node.lastError} />
                  </div>
                  <p className="truncate text-[11px] text-zinc-400">
                    {node.secure ? "wss" : "ws"}://{node.host}:{node.port}
                    {node.lastError ? ` — ${node.lastError}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleTest(node.id)} disabled={testingId === node.id} className="h-7 w-7 p-0 text-zinc-400">
                  <RefreshCw className={`h-3.5 w-3.5 ${testingId === node.id ? "animate-spin" : ""}`} />
                </Button>
                <button
                  onClick={() => handleToggleEnabled(node)}
                  className={`h-6 w-10 rounded-full transition-colors ${node.enabled ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
                  aria-label={node.enabled ? "Disable node" : "Enable node"}
                >
                  <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${node.enabled ? "translate-x-5" : "translate-x-1"}`} />
                </button>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(node.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
