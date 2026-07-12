"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart2,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  GitBranch,
  GraduationCap,
  Home,
  LogOut,
  PenTool,
  Search,
  Settings,
  Shield,
  Target,
  Terminal,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const { isCollapsed, toggleCollapse } = useSidebarStore();
  const { toggleOpen: toggleCommandPalette } = useCommandPaletteStore();

  // Keyboard shortcut to collapse sidebar: [ (bracket left)
  useKeyboardShortcut({ key: "[" }, () => {
    toggleCollapse();
  });

  const menuItems = [
    { name: "Notes", href: "/notes", icon: FileText },
    { name: "Doodle", href: "/doodle", icon: PenTool },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Projects", href: "/projects", icon: FolderOpen },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Developer Mode", href: "/developer", icon: Terminal },
    { name: "Study Mode", href: "/study", icon: GraduationCap },
    { name: "Habits", href: "/habits", icon: Activity },
    { name: "Goals", href: "/goals", icon: Target },
    { name: "Analytics", href: "/analytics", icon: BarChart2 },
    ...(session?.user?.role === "ADMIN" ? [{ name: "Admin · Music", href: "/admin/music", icon: Shield }] : []),
  ];

  // Mask the email so it isn't shown in full in the UI (e.g. "yadav***@gmail.com")
  const maskEmail = (email: string) => {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const visible = local.slice(0, Math.min(5, local.length));
    return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
  };

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : session?.user?.email
    ? session.user.email.slice(0, 2).toUpperCase()
    : "US";

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-zinc-500 dark:text-zinc-400 transition-all duration-300 ease-in-out z-30",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header section with brand logo */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link
          href="/notes"
          className="flex items-center gap-2.5 font-semibold text-zinc-900 dark:text-white tracking-tight overflow-hidden whitespace-nowrap"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-500">
            <GitBranch className="h-4.5 w-4.5" />
          </div>
          {!isCollapsed && <span className="text-sm font-bold bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">DailyOS</span>}
        </Link>

        {!isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="h-7 w-7 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Quick Search Section */}
      <div className="px-3 py-4">
        {isCollapsed ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCommandPalette}
            className="w-10 h-10 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 mx-auto block rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
          >
            <Search className="h-4.5 w-4.5 mx-auto" />
          </Button>
        ) : (
          <button
            onClick={toggleCommandPalette}
            className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 px-3 py-1.5 text-left text-xs text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search...</span>
            <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-0.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-950 px-1.5 font-mono text-[9px] font-medium text-zinc-500">
              <span className="text-xs">Ctrl</span>K
            </kbd>
          </button>
        )}
      </div>

      {/* Navigation menu list */}
      <nav className="flex-1 space-y-1 px-3 py-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
                isActive
                  ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 shadow-sm"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-950 hover:text-zinc-700 dark:hover:text-zinc-200 border border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-blue-500" : "text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
                )}
              />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button when collapsed */}
      {isCollapsed && (
        <div className="flex justify-center p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Footer user profile dropdown */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        {sessionStatus === "loading" ? (
          <div className="flex w-full items-center gap-3 rounded-lg p-1.5">
            <div className="h-7 w-7 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 gap-1.5 overflow-hidden">
                <div className="h-2.5 w-20 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                <div className="h-2 w-14 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
              </div>
            )}
          </div>
        ) : (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900/60 transition-colors focus:outline-none cursor-pointer">
            <Avatar className="h-7 w-7 border border-zinc-300 dark:border-zinc-800 shrink-0">
              <AvatarImage src={session?.user?.image || ""} />
              <AvatarFallback className="bg-blue-600/10 text-blue-500 text-xs font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 overflow-hidden">
                <span className="truncate text-xs font-semibold text-zinc-900 dark:text-white leading-tight">
                  {session?.user?.name || "User Account"}
                </span>
                <span className="truncate text-[10px] text-zinc-500 mt-0.5">
                  {session?.user?.email ? maskEmail(session.user.email) : ""}
                </span>
              </div>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
            <DropdownMenuLabel className="text-xs text-zinc-900 dark:text-white">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
            <DropdownMenuItem onClick={() => router.push("/settings")} className="hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:bg-zinc-100 dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-white text-xs cursor-pointer flex items-center gap-2">
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="hover:bg-zinc-900 focus:bg-red-950/30 focus:text-red-400 text-xs text-red-500 cursor-pointer flex items-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>
    </aside>
  );
}
