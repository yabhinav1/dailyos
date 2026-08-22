import { create } from "zustand";

/**
 * App-wide toasts. Call `toast.success("…")` / `toast.error("…")` from any
 * client code — the <Toaster /> in the root layout renders whatever is here.
 *
 * Kept deliberately small: no queues, no promises, no custom renderers. The
 * one enrichment is a single optional action, because "Undo" is the whole
 * reason destructive operations can skip a confirmation dialog.
 */
export type Toast = {
  id: number;
  kind: "success" | "error";
  message: string;
  action?: { label: string; onClick: () => void };
};

type ToastState = {
  toasts: Toast[];
  push: (kind: Toast["kind"], message: string, action?: Toast["action"]) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

// Errors linger longer: they carry information the user did not expect.
const DURATION_MS: Record<Toast["kind"], number> = {
  success: 3500,
  error: 6000,
};

const MAX_VISIBLE = 3;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message, action) => {
    const id = nextId++;
    set((s) => ({
      // Oldest drops when the stack is full — three is already a lot to read.
      toasts: [...s.toasts, { id, kind, message, action }].slice(-MAX_VISIBLE),
    }));
    // A toast carrying an action stays up longer: it is a decision window,
    // not just a notice.
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, action ? 8000 : DURATION_MS[kind]);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative surface, so callers don't need the hook or a component. */
export const toast = {
  success: (message: string, action?: Toast["action"]) =>
    useToastStore.getState().push("success", message, action),
  error: (message: string) => useToastStore.getState().push("error", message),
};
