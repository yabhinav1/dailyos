"use client";

import React, { useState } from "react";
import { CheckCircle2, Database, Eye, EyeOff, Lock, Mail, SlidersHorizontal, User, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

export const SETTINGS_TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "account", label: "Account", icon: Mail },
  { key: "security", label: "Security", icon: Lock },
  { key: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { key: "data", label: "Data", icon: Database },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["key"];

/** Renders its children only while its section is the selected one. */
export function SettingsSection({
  active,
  name,
  children,
}: {
  active: SettingsTab;
  name: SettingsTab;
  children: React.ReactNode;
}) {
  if (active !== name) return null;
  return <>{children}</>;
}

export type Banner = { type: "success" | "error"; text: string } | null;

export function InlineBanner({ banner, onDismiss }: { banner: Banner; onDismiss: () => void }) {
  if (!banner) return null;
  const isSuccess = banner.type === "success";
  return (
    <div
      className={`flex items-start gap-2 p-3 text-xs rounded-lg border ${
        isSuccess
          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          : "text-red-400 bg-red-500/10 border-red-500/20"
      }`}
    >
      {isSuccess ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
      <span className="flex-1">{banner.text}</span>
      <button onClick={onDismiss} className="text-[11px] opacity-70 hover:opacity-100">
        Dismiss
      </button>
    </div>
  );
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
  minLength,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  minLength?: number;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        minLength={minLength}
        className="bg-zinc-900/50 border-zinc-800 text-white text-xs h-9 pr-9 focus-visible:ring-1 focus-visible:ring-blue-500/40"
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-200 transition-colors p-0.5 rounded focus:outline-none"
        tabIndex={-1}
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function GithubMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 5.02 3.26 9.28 7.78 10.78.57.1.78-.25.78-.55v-1.94c-3.16.69-3.83-1.36-3.83-1.36-.52-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.24 3.31.95.1-.73.4-1.24.72-1.53-2.52-.29-5.17-1.26-5.17-5.6 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.16a10.9 10.9 0 0 1 2.86-.39c.97 0 1.94.13 2.86.39 2.18-1.47 3.14-1.16 3.14-1.16.62 1.57.23 2.73.11 3.02.73.79 1.17 1.8 1.17 3.04 0 4.35-2.65 5.31-5.18 5.59.41.35.77 1.04.77 2.11v3.13c0 .3.21.66.79.55A11.26 11.26 0 0 0 23.25 11.75C23.25 5.48 18.27.5 12 .5Z" />
    </svg>
  );
}

export const PROVIDER_LABEL: Record<string, string> = {
  github: "GitHub",
  credentials: "Email & Password",
};
