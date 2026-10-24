"use client";

import React, { useEffect, useState } from "react";
import { Check, Globe, Link2, Lock, RefreshCw, UserPlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/stores/toast-store";

type Role = "VIEW" | "EDIT";
type LinkAccess = "NONE" | "VIEW" | "EDIT";
type Share = { id: string; email: string; role: string };
type Settings = { link: string; linkAccess: LinkAccess; shares: Share[] };

/** The server operations behind the dialog, for whatever is being shared. */
export type ShareApi = {
  load: () => Promise<{ success: boolean; data?: Settings; message?: string }>;
  setLinkAccess: (access: LinkAccess) => Promise<unknown>;
  invite: (email: string, role: Role) => Promise<{ success: boolean; data?: Share; message?: string }>;
  remove: (shareId: string) => Promise<unknown>;
  reset: () => Promise<{ success: boolean; data?: { link: string } }>;
};

const selectClass =
  "h-8 rounded-lg border border-zinc-800 bg-[#1f1f1f] px-2 text-xs text-white focus:border-zinc-700 focus:outline-none";

interface ShareDialogProps {
  /** What the link opens: "note" or "project", for the wording. */
  kind: "note" | "project";
  /** Changes when the dialog should load a different item. */
  itemKey: string;
  title: string;
  api: ShareApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reports whether anyone besides the owner can now reach the note. */
  onSharingChange?: (shared: boolean) => void;
}

/** Google Docs-style sharing for a note or project: people by email, plus
 * general link access. */
export default function ShareDialog({ kind, itemKey, title, api, open, onOpenChange, onSharingChange }: ShareDialogProps) {
  const confirm = useConfirm();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("EDIT");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Drop the last session's settings on reopen: showing them while the fresh
  // copy loads let a change made in that window be overwritten by the fetch.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setSettings(null);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const res = await api.load();
      if (cancelled) return;
      if (res.success && res.data) setSettings(res.data);
      else toast.error(res.message || "Couldn't load sharing settings.");
    })();
    return () => {
      cancelled = true;
    };
    // api is rebuilt every render; itemKey says when it points somewhere new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemKey]);

  // The page is told only once the server has the change: it refreshes on
  // the news, and a refresh racing the write would read the old value back.
  const update = (next: Settings) => setSettings(next);
  const confirmed = (next: Settings) => onSharingChange?.(next.linkAccess !== "NONE" || next.shares.length > 0);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !email.trim()) return;
    setBusy(true);
    const res = await api.invite(email, role);
    setBusy(false);
    if (!res.success || !res.data) {
      toast.error(res.message || "Couldn't share the note.");
      return;
    }
    const share = res.data;
    const next = {
      ...settings,
      shares: settings.shares.some((s) => s.id === share.id)
        ? settings.shares.map((s) => (s.id === share.id ? share : s))
        : [...settings.shares, share],
    };
    update(next);
    confirmed(next);
    setEmail("");
    toast.success(`Shared with ${share.email}.`);
  };

  const changeRole = async (shareEmail: string, next: Role) => {
    if (!settings) return;
    const res = await api.invite(shareEmail, next);
    if (!res.success || !res.data) return toast.error(res.message || "Couldn't change access.");
    const share = res.data;
    update({ ...settings, shares: settings.shares.map((s) => (s.id === share.id ? share : s)) });
  };

  const remove = async (shareId: string) => {
    if (!settings) return;
    const previous = settings;
    const next = { ...settings, shares: settings.shares.filter((s) => s.id !== shareId) };
    update(next);
    try {
      await api.remove(shareId);
      confirmed(next);
    } catch {
      update(previous);
      toast.error("Couldn't remove access.");
    }
  };

  const setLinkAccess = async (next: LinkAccess) => {
    if (!settings) return;
    const previous = settings;
    const updated = { ...settings, linkAccess: next };
    update(updated);
    try {
      await api.setLinkAccess(next);
      confirmed(updated);
    } catch {
      update(previous);
      toast.error("Couldn't change link access.");
    }
  };

  const copyLink = async () => {
    if (!settings) return;
    try {
      await navigator.clipboard.writeText(settings.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  };

  const resetLink = async () => {
    if (!settings) return;
    const ok = await confirm({
      title: "Reset the link?",
      body: "The current link stops working. People you invited by email keep access through the new one.",
      confirmLabel: "Reset link",
      destructive: true,
    });
    if (!ok) return;
    const res = await api.reset();
    if (res.success && res.data) {
      update({ ...settings, link: res.data.link });
      toast.success("New link created. The old one no longer works.");
    }
  };

  const restricted = settings?.linkAccess === "NONE";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-white truncate">Share &ldquo;{title || `Untitled ${kind}`}&rdquo;</DialogTitle>
        </DialogHeader>

        {!settings ? (
          <p className="py-6 text-center text-xs text-zinc-400">Loading…</p>
        ) : (
          <div className="space-y-5 pt-1">
            {/* Invite */}
            <form onSubmit={invite} className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Add people by email"
                aria-label="Email address to share with"
                className="flex-1 min-w-0 h-8 px-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs text-white placeholder-zinc-400 outline-none focus:border-zinc-700"
                disabled={busy}
              />
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role for new person" className={selectClass}>
                <option value="EDIT">Editor</option>
                <option value="VIEW">Viewer</option>
              </select>
              <Button type="submit" size="sm" disabled={busy || !email.trim()} className="h-8 text-xs gap-1">
                <UserPlus className="h-3.5 w-3.5" /> Share
              </Button>
            </form>

            {/* People */}
            <section className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">People with access</h3>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-200">You</span>
                <span className="text-zinc-400">Owner</span>
              </div>
              {settings.shares.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-zinc-200" title={s.email}>{s.email}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={s.role}
                      onChange={(e) => changeRole(s.email, e.target.value as Role)}
                      aria-label={`Role for ${s.email}`}
                      className={selectClass}
                    >
                      <option value="EDIT">Editor</option>
                      <option value="VIEW">Viewer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      aria-label={`Remove ${s.email}`}
                      className="p-1 text-zinc-400 hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </section>

            {/* General access */}
            <section className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">General access</h3>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-full p-1.5 ${restricted ? "bg-zinc-800 text-zinc-300" : "bg-emerald-500/15 text-emerald-400"}`}>
                  {restricted ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 space-y-1">
                  <select
                    value={restricted ? "RESTRICTED" : "ANYONE"}
                    onChange={(e) => setLinkAccess(e.target.value === "RESTRICTED" ? "NONE" : "VIEW")}
                    aria-label="General access"
                    className={`${selectClass} w-full`}
                  >
                    <option value="RESTRICTED">Restricted</option>
                    <option value="ANYONE">Anyone with the link</option>
                  </select>
                  <p className="text-[11px] text-zinc-400">
                    {restricted
                      ? "Only people added above can open it, after signing in."
                      : "Anyone on the internet with the link can open it, no sign-in needed."}
                  </p>
                </div>
                {!restricted && (
                  <select
                    value={settings.linkAccess}
                    onChange={(e) => setLinkAccess(e.target.value as LinkAccess)}
                    aria-label="Link access role"
                    className={selectClass}
                  >
                    <option value="VIEW">Viewer</option>
                    <option value="EDIT">Editor</option>
                  </select>
                )}
              </div>
            </section>

            {/* Link */}
            <div className="flex items-center justify-between gap-2 border-t border-zinc-900 pt-4">
              <button
                type="button"
                onClick={resetLink}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                title="Make a new link and stop the current one from working"
              >
                <RefreshCw className="h-3 w-3" /> Reset link
              </button>
              <Button type="button" variant="outline" onClick={copyLink} className="h-8 text-xs gap-1.5 border-zinc-700 text-zinc-200">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
