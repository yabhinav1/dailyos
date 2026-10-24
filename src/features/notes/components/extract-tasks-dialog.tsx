"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createTask } from "@/features/tasks/actions";
import type { ExtractedTask } from "@/features/notes/ai-actions";
import { toast } from "@/stores/toast-store";
import { formatDay } from "@/lib/dates";

interface ExtractTasksDialogProps {
  tasks: ExtractedTask[] | null;
  usedAi: boolean;
  onClose: () => void;
}

/** Review step between "extract action items" and real tasks being created. */
export default function ExtractTasksDialog({ tasks, usedAi, onClose }: ExtractTasksDialogProps) {
  const router = useRouter();
  const [picked, setPicked] = useState<boolean[]>([]);
  const [creating, setCreating] = useState(false);

  // Reset the ticks whenever a new extraction arrives.
  const [seen, setSeen] = useState<ExtractedTask[] | null>(null);
  if (tasks !== seen) {
    setSeen(tasks);
    setPicked(tasks?.map((t) => t.suggested) ?? []);
  }

  const count = picked.filter(Boolean).length;

  const create = async () => {
    if (!tasks) return;
    setCreating(true);
    let made = 0;
    for (const [i, t] of tasks.entries()) {
      if (!picked[i]) continue;
      try {
        await createTask({ title: t.title, dueDate: t.dueDate ?? null, ...(t.priority && { priority: t.priority }) });
        made++;
      } catch {
        // Keep going; the count in the toast says how many made it.
      }
    }
    setCreating(false);
    onClose();
    if (made === count) {
      toast.success(`Created ${made} task${made === 1 ? "" : "s"}.`, { label: "Open tasks", onClick: () => router.push("/tasks") });
    } else {
      toast.error(`Created ${made} of ${count} tasks. Try the rest again.`);
    }
  };

  return (
    <Dialog open={tasks !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-white">Create tasks from this note</DialogTitle>
        </DialogHeader>
        {tasks && tasks.length === 0 ? (
          <p className="py-4 text-xs text-zinc-400">
            No action items found.{" "}
            {usedAi
              ? "Try writing them as a list."
              : 'Mark them with "[ ]" or "TODO:", or put them in a bullet list. (Set OPENAI_API_KEY for AI extraction.)'}
          </p>
        ) : (
          <>
            <p className="text-[11px] text-zinc-400">
              {usedAi ? "Found by AI." : "Found from to-do markers and bullet points."} Untick anything you don&apos;t want.
            </p>
            <ul className="max-h-72 overflow-y-auto space-y-1">
              {tasks?.map((t, i) => (
                <li key={i}>
                  <label className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-900/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={picked[i] ?? false}
                      onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))}
                      className="mt-0.5 h-3.5 w-3.5"
                    />
                    <span className="flex-1 min-w-0 text-xs text-zinc-200">
                      {t.title}
                      {(t.dueDate || (t.priority && t.priority !== "MEDIUM")) && (
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-400">
                          {t.dueDate && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" /> {formatDay(`${t.dueDate}T00:00:00Z`)}
                            </span>
                          )}
                          {t.priority && t.priority !== "MEDIUM" && <span>{t.priority.toLowerCase()} priority</span>}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
          <Button type="button" variant="outline" onClick={onClose} className="border-zinc-800 text-zinc-300 text-xs h-8">
            Cancel
          </Button>
          {tasks && tasks.length > 0 && (
            <Button type="button" onClick={create} disabled={creating || count === 0} className="text-xs font-semibold h-8">
              {creating ? "Creating…" : `Create ${count} task${count === 1 ? "" : "s"}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
