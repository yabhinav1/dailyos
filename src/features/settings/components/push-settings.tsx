"use client";

import React, { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/features/settings/push-actions";
import { toast } from "@/stores/toast-store";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State =
  | { kind: "loading" }
  | { kind: "unsupported"; reason: string }
  | { kind: "blocked" }
  | { kind: "off" }
  | { kind: "on"; endpoint: string };

/** The VAPID key arrives base64url-encoded; subscribe() wants raw bytes. */
function keyBytes(base64url: string) {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  // public/sw.js is only auto-registered in production builds.
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/**
 * Phone and desktop notifications for the morning reminder, per browser.
 * Needs the browser's permission; on iPhone and iPad the app must be added
 * to the Home Screen first (Safari only offers push to installed apps).
 */
export default function PushSettings() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      if (!VAPID_KEY) next = { kind: "unsupported", reason: "Notifications aren't set up on this server yet." };
      else if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        next = {
          kind: "unsupported",
          reason: /iPhone|iPad|iPod/.test(navigator.userAgent)
            ? "On iPhone and iPad, add DailyOS to your Home Screen (Share › Add to Home Screen), then turn this on from there."
            : "This browser doesn't support notifications.",
        };
      } else if (Notification.permission === "denied") next = { kind: "blocked" };
      else {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        next = sub ? { kind: "on", endpoint: sub.endpoint } : { kind: "off" };
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? { kind: "blocked" } : { kind: "off" });
        return;
      }
      const reg = await getRegistration();
      await navigator.serviceWorker.ready;
      // The browser registers with its push service (Google's, Apple's or
      // Mozilla's) here; a blocked network can leave that hanging forever.
      const sub = await Promise.race([
        reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY!) }),
        new Promise<never>((_, reject) =>
          // A browser's first registration can take half a minute.
          setTimeout(() => reject(new Error("Your browser's push service didn't respond. Check your connection and try again.")), 60000)
        ),
      ]);
      const res = await savePushSubscriptionAction(sub.toJSON());
      if (!res.success) throw new Error(res.message);
      setState({ kind: "on", endpoint: sub.endpoint });
      toast.success("Notifications are on for this device.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't turn on notifications.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (state.kind !== "on") return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      await removePushSubscriptionAction(state.endpoint);
      setState({ kind: "off" });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    const res = await sendTestPushAction();
    setBusy(false);
    if (res.success) toast.success("Sent. It should appear in a few seconds.");
    else toast.error(res.message || "Couldn't send a test notification.");
  };

  return (
    <div className="flex items-start justify-between gap-4 border-t border-zinc-900 pt-4">
      <div className="space-y-0.5">
        <Label className="text-xs text-zinc-200 flex items-center gap-1.5">
          <BellRing className="h-3.5 w-3.5" /> Notifications on this device
        </Label>
        <p className="text-[11px] text-zinc-400">
          {state.kind === "unsupported"
            ? state.reason
            : state.kind === "blocked"
              ? "Blocked in your browser's site settings. Allow notifications for this site there, then reload."
              : "Get the morning reminder as a phone or desktop notification too."}
        </p>
      </div>
      {(state.kind === "on" || state.kind === "off") && (
        <div className="flex items-center gap-2 shrink-0">
          {state.kind === "on" && (
            <button type="button" onClick={test} disabled={busy} className="text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-50">
              Send test
            </button>
          )}
          <button
            type="button"
            onClick={state.kind === "on" ? disable : enable}
            disabled={busy}
            className={`h-7 px-3 rounded-lg text-[11px] font-semibold disabled:opacity-50 ${
              state.kind === "on" ? "border border-zinc-700 text-zinc-200 hover:border-zinc-600" : "bg-zinc-100 text-zinc-900 hover:bg-white"
            }`}
          >
            {busy && state.kind === "off" ? "Turning on…" : state.kind === "on" ? "Turn off" : "Turn on"}
          </button>
        </div>
      )}
    </div>
  );
}
