"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { useToastStore } from "@/stores/toast-store";

/**
 * Renders the toast stack. Mounted once, in the root layout.
 *
 * Sits above the deletion guard (z-200) on purpose: even while that dialog
 * blocks the workspace, the outcome of "Keep my account" still needs somewhere
 * to appear.
 */
export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-zinc-850 bg-[#161618] px-3.5 py-2.5 shadow-xl shadow-black/40"
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-zinc-100">
              {t.message}
            </p>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-0.5 text-zinc-400 transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
