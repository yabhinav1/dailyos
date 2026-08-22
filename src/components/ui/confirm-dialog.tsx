"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Promise-based replacement for the browser's `confirm()`.
 *
 * The native dialog cannot be styled, looks like the operating system rather
 * than the app, and blocks the main thread while it is open — and browsers are
 * free to suppress it outright if a page shows too many. This resolves the same
 * boolean, so a call site changes only by awaiting it.
 */
export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the action as destructive and gives it the warning icon. */
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  // Held separately so closing by Escape or backdrop still settles the promise
  // rather than leaving the caller awaiting forever.
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = (ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          // Dismissing by any route means "no".
          if (!open) settle(false);
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-sm">
          {pending?.destructive && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}

          <DialogTitle className="text-sm font-bold text-white">
            {pending?.title}
          </DialogTitle>

          {pending?.body && (
            <DialogDescription className="text-sm leading-relaxed text-zinc-300">
              {pending.body}
            </DialogDescription>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => settle(false)}
              className="border-zinc-800 text-xs font-semibold"
            >
              {pending?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              size="sm"
              autoFocus
              onClick={() => settle(true)}
              className={`text-xs font-semibold ${
                pending?.destructive ? "bg-red-600 text-white hover:bg-red-500" : ""
              }`}
            >
              {pending?.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
