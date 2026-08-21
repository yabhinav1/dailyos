"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  cancelAccountDeletion,
  signOutPendingDeletion,
} from "@/features/settings/account-actions";
import { getErrorMessage } from "@/lib/utils";

/**
 * Blocks the workspace while an account is scheduled for deletion.
 *
 * Signing in during the grace period has to be a decision, so this offers only
 * two ways out — keep the account or leave — and deliberately has no backdrop
 * click, no Escape and no close button. It is rendered by the dashboard
 * layout, so it covers every route behind the sign-in wall.
 */
export default function DeletionGuard({ deletesAt }: { deletesAt: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"cancel" | "signout" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const target = new Date(deletesAt).getTime();
    const tick = () => {
      const ms = target - Date.now();
      if (ms <= 0) {
        setRemaining("any moment now");
        return;
      }
      const hours = Math.floor(ms / 3_600_000);
      const minutes = Math.floor((ms % 3_600_000) / 60_000);
      setRemaining(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [deletesAt]);

  // Nothing behind this should be reachable by keyboard while it is up.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const keepAccount = async () => {
    setBusy("cancel");
    setError(null);
    try {
      const res = await cancelAccountDeletion();
      if (res.success) {
        router.refresh();
      } else {
        setError(res.message || "Couldn't cancel the deletion.");
        setBusy(null);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Couldn't cancel the deletion."));
      setBusy(null);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="deletion-guard-title"
      aria-describedby="deletion-guard-body"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-850 bg-[#111113] p-6 shadow-2xl">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <h2 id="deletion-guard-title" className="text-base font-bold text-white">
          This account is scheduled for deletion
        </h2>

        <p id="deletion-guard-body" className="mt-2 text-sm leading-relaxed text-zinc-300">
          Everything in this workspace — notes, tasks, habits, goals, files —
          will be permanently deleted in{" "}
          <strong className="text-white">{remaining}</strong>. This cannot be
          undone once it happens.
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          Keeping the account cancels the deletion entirely. Signing out leaves
          it scheduled.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={keepAccount}
            disabled={busy !== null}
            autoFocus
            className="flex-1 text-xs font-semibold"
          >
            {busy === "cancel" ? "Cancelling…" : "Keep my account"}
          </Button>
          <form action={signOutPendingDeletion} className="flex-1">
            <Button
              type="submit"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setBusy("signout")}
              className="w-full border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white"
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
