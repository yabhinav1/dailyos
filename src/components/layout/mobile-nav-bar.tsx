"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { CheckSquare, FileText, Calendar, LayoutGrid, LogOut, Moon, Settings, Sun, Monitor } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ADMIN_NAV_ITEM, NAV_ITEMS, isActivePath } from "./nav-items";

// The four pages people open most; everything else is under More.
const PRIMARY = [
  { label: "Today", href: "/today", icon: Sun },
  { label: "Notes", href: "/notes", icon: FileText },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Calendar", href: "/calendar", icon: Calendar },
];

/**
 * Phone navigation, in place of the sidebar below the md breakpoint: four
 * main pages plus More, which opens every page, Settings, theme and sign-out.
 */
export default function MobileNavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  const all = [...NAV_ITEMS, ...(session?.user?.role === "ADMIN" ? [ADMIN_NAV_ITEM] : [])];
  const onPrimary = PRIMARY.some((p) => isActivePath(pathname, p.href));

  const tab = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-1.5 rounded-lg transition-colors ${
      active ? "text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
    }`;

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-zinc-800 bg-[#0d0d0d]/95 backdrop-blur-md px-1 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-stretch">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={tab(active)}>
                <Icon className="h-5 w-5" />
                <span className="text-[11px] tracking-tight">{item.label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={tab(!onPrimary)}>
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[11px] tracking-tight">More</span>
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-auto bottom-0 left-0 translate-x-0 translate-y-0 w-full max-w-none rounded-b-none rounded-t-2xl border-t border-zinc-800 bg-[#171717] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden"
        >
          <DialogTitle className="text-xs font-bold uppercase tracking-wider text-zinc-400">All pages</DialogTitle>
          <div className="grid grid-cols-4 gap-1">
            {all.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 py-3 text-center transition-colors ${
                    active ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-900"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] leading-tight">{item.short}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-zinc-800 pt-3">
            <div className="flex rounded-lg border border-zinc-800 p-0.5" role="group" aria-label="Theme">
              {([
                ["light", Sun],
                ["dark", Moon],
                ["system", Monitor],
              ] as const).map(([value, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
                  aria-label={`${value} theme`}
                  className={`h-8 w-9 inline-flex items-center justify-center rounded-md ${theme === value ? "bg-zinc-800 text-white" : "text-zinc-400"}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/settings"
                onClick={() => setMoreOpen(false)}
                className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs text-zinc-200 hover:bg-zinc-900"
              >
                <Settings className="h-4 w-4" /> Settings
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs text-red-400 hover:bg-zinc-900"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
