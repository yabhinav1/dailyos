"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Command,
  Download,
  FileText,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { completeOnboarding } from "@/features/settings/onboarding-actions";

type Step = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to DailyOS",
    body: "Your notes, tasks, habits, goals, calendar and study log all live here, in one workspace. Here are the three things worth knowing before you start.",
  },
  {
    icon: FileText,
    title: "Notes have three modes",
    body: "Write is rich text. Doodle is a sketch pad. Canvas is freeform — double-click anywhere on the grid to drop a text block, then drag it where you want it.",
  },
  {
    icon: Command,
    title: "Cmd + K goes anywhere",
    body: "The command palette jumps straight to any page without touching the sidebar. Ctrl + K on Windows and Linux.",
  },
  {
    icon: Download,
    title: "Your data stays yours",
    body: "Settings › Data will email you a complete copy of everything you have, any time you ask — and the same page is where you'd delete the account.",
  },
];

/**
 * First-run walkthrough, shown once per account.
 *
 * Skipping counts as done: nagging someone who has already said no is worse
 * than them missing a tip, and every one of these is discoverable in the app
 * anyway.
 */
export default function WelcomeTour() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [closing, setClosing] = useState(false);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const Icon = step.icon;

  const finish = async () => {
    setClosing(true);
    // Record it, then drop the dialog either way — a failed write should not
    // trap someone behind a welcome screen.
    await completeOnboarding();
    router.refresh();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !closing) void finish();
      }}
    >
      <DialogContent showCloseButton={false} className="max-w-md sm:max-w-md">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400">
          <Icon className="h-5 w-5" />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <DialogTitle className="text-base font-bold text-white">
              {step.title}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-zinc-300">
              {step.body}
            </DialogDescription>
          </motion.div>
        </AnimatePresence>

        <div className="mt-2 flex items-center justify-between gap-4">
          {/* Progress, and a way to jump between steps rather than only forward */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-current={i === index ? "step" : undefined}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-blue-500" : "w-1.5 bg-zinc-700 hover:bg-zinc-600"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isLast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={finish}
                disabled={closing}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Skip
              </Button>
            )}
            <Button
              size="sm"
              autoFocus
              disabled={closing}
              onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
              className="text-xs font-semibold"
            >
              {isLast ? (closing ? "Starting…" : "Get started") : "Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
