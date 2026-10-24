import React from "react";
import Link from "next/link";
import { CalendarDays, CheckSquare, FileText, GitBranch, Users } from "lucide-react";

const FEATURES = [
  { icon: CheckSquare, text: "Tasks, habits and goals that know what today is" },
  { icon: FileText, text: "Notes with sketches, voice notes and version history" },
  { icon: Users, text: "Share notes and projects, edit together" },
  { icon: CalendarDays, text: "A calendar and a morning reminder, in your time zone" },
];

/**
 * Sign-in, sign-up and recovery pages. Large screens get a two-panel layout
 * (what DailyOS is on the left, the form on the right); phones get just the
 * form, full width, with no card around it to waste the edges.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-[#0a0a0a] text-foreground lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — large screens only */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-gradient-to-br from-blue-950/50 via-[#0b0d14] to-[#0a0a0a] p-12">
        <div className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-blue-600/20 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-indigo-600/10 blur-[120px]" />

        <Link href="/" className="relative flex items-center gap-2.5 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/15 border border-blue-500/25 text-blue-400">
            <GitBranch className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">DailyOS</span>
        </Link>

        <div className="relative max-w-md space-y-8">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
            Your whole day,
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">in one place.</span>
          </h2>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-zinc-300">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-blue-300">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-zinc-500">Free to use · Your data stays yours, export it any time</p>
      </aside>

      {/* Form panel */}
      <main className="relative flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-blue-600/10 to-transparent lg:hidden" />
        <div className="relative w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
