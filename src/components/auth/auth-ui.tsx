"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { GitBranch, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared pieces of the sign-in pages, so login, sign-up and recovery look
 * like one product. Inputs are 16px on phones: anything smaller makes iOS
 * zoom the page when the field is tapped.
 */

export const authInputClass =
  "h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 pl-10 pr-3 text-base sm:text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60";

export const authPrimaryButtonClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:opacity-60";

export function AuthHeader({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {/* The brand panel carries the logo on large screens. */}
      <div className="mb-6 flex items-center gap-2.5 lg:hidden">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/15 border border-blue-500/25 text-blue-400">
          <GitBranch className="h-5 w-5" />
        </span>
        <span className="text-lg font-bold tracking-tight text-white">DailyOS</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[28px]">{title}</h1>
      <p className="text-sm text-zinc-400">{subtitle}</p>
    </div>
  );
}

/** A labelled input with a leading icon. */
export function AuthField({
  id,
  label,
  icon: Icon,
  error,
  trailing,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-zinc-200">
          {label}
        </label>
        {trailing}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input id={id} {...input} aria-invalid={error ? true : undefined} className={cn(authInputClass, input.className)} />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function AuthAlert({ tone, children }: { tone: "error" | "success" | "warning"; children: React.ReactNode }) {
  const styles = {
    error: "border-red-500/20 bg-red-500/10 text-red-300",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border p-3 text-[13px] leading-relaxed", styles)}>
      {children}
    </div>
  );
}

export function AuthDivider({ children = "or" }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs text-zinc-500">
      <span className="h-px flex-1 bg-zinc-800" />
      {children}
      <span className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 5.02 3.26 9.28 7.78 10.78.57.1.78-.25.78-.55v-1.94c-3.16.69-3.83-1.36-3.83-1.36-.52-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.24 3.31.95.1-.73.4-1.24.72-1.53-2.52-.29-5.17-1.26-5.17-5.6 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.16a10.9 10.9 0 0 1 2.86-.39c.97 0 1.94.13 2.86.39 2.18-1.47 3.14-1.16 3.14-1.16.62 1.57.23 2.73.11 3.02.73.79 1.17 1.8 1.17 3.04 0 4.35-2.65 5.31-5.18 5.59.41.35.77 1.04.77 2.11v3.13c0 .3.21.66.79.55A11.26 11.26 0 0 0 23.25 11.75C23.25 5.48 18.27.5 12 .5Z" />
  </svg>
);

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path fill="#4285F4" d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.17-2 3.44-4.95 3.44-8.56Z" />
    <path fill="#34A853" d="M12 23.5c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.75H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z" />
    <path fill="#FBBC05" d="M5.55 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.7a11.5 11.5 0 0 0 0 10.3l3.85-2.98Z" />
    <path fill="#EA4335" d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.28 15.11.25 12 .25A11.5 11.5 0 0 0 1.7 6.85l3.85 2.98C6.46 7.1 9 4.75 12 4.75Z" />
  </svg>
);

/** "Continue with Google / GitHub", which signs in or creates the account. */
export function OAuthButtons({ callbackUrl, disabled }: { callbackUrl: string; disabled?: boolean }) {
  const [pending, setPending] = useState<"google" | "github" | null>(null);
  const go = async (provider: "google" | "github") => {
    setPending(provider);
    await signIn(provider, { callbackUrl });
  };
  const button =
    "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-sm font-medium text-white transition-colors hover:border-zinc-700 hover:bg-zinc-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-60";
  return (
    <div className="grid gap-2.5">
      <button type="button" className={button} onClick={() => go("google")} disabled={disabled || pending !== null}>
        {pending === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon className="h-[18px] w-[18px]" />}
        Continue with Google
      </button>
      <button type="button" className={button} onClick={() => go("github")} disabled={disabled || pending !== null}>
        {pending === "github" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GithubIcon className="h-[18px] w-[18px]" />}
        Continue with GitHub
      </button>
    </div>
  );
}
