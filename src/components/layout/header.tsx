"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useTheme } from "next-themes";
import { Bell, Menu, Moon, Sun, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Loader } from "@/components/ui/loader";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";
import FocusTimerBar from "@/components/focus/focus-timer-bar";
import { getErrorMessage } from "@/lib/utils";
import type { Notification } from "@/lib/types";

const typeDotColor: Record<string, string> = {
  INFO: "bg-blue-500",
  WARNING: "bg-amber-500",
  SUCCESS: "bg-emerald-500",
  CALENDAR: "bg-violet-500",
  TASK: "bg-sky-500",
};

export default function Header() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse } = useSidebarStore();
  const { setTheme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  const [reloadToken, setReloadToken] = useState(0);
  const reloadNotifications = useCallback(() => setReloadToken((n) => n + 1), []);

  // Loads once per reload token and then polls every minute. A response that
  // arrives after the effect has been torn down is dropped.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingNotifs(true);
      setNotifError(null);
      try {
        const res = await getNotifications();
        if (cancelled) return;
        if (res.success) {
          // Guard against a malformed/non-array payload so a bad response
          // can never throw during render (which used to crash the whole
          // page via the root error boundary).
          setNotifications(Array.isArray(res.data) ? res.data : []);
          setUnreadCount(typeof res.unreadCount === "number" ? res.unreadCount : 0);
        } else {
          setNotifications([]);
          setUnreadCount(0);
          setNotifError(res.message || "Couldn't load notifications.");
        }
      } catch (err: unknown) {
        // Belt-and-suspenders: even an unexpected/network-level failure
        // stays contained to the dropdown instead of bubbling up.
        if (cancelled) return;
        setNotifications([]);
        setUnreadCount(0);
        setNotifError(getErrorMessage(err, "Couldn't load notifications."));
      } finally {
        if (!cancelled) setLoadingNotifs(false);
      }
    };

    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [reloadToken]);

  const handleOpenChange = (open: boolean) => {
    setNotifOpen(open);
    if (open) reloadNotifications();
  };

  const handleNotifClick = async (id: string, read: boolean) => {
    if (read) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    const res = await markNotificationRead(id);
    if (!res.success) reloadNotifications();
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    const res = await markAllNotificationsRead();
    if (!res.success) reloadNotifications();
  };
  const pathSegments = pathname.split("/").filter(Boolean);
  
  const formatSegment = (segment: string) => {
    return segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-[#0d0d0d]/85 backdrop-blur-md px-6">
      <div className="flex items-center gap-4">
        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
          >
            <Menu className="h-4.5 w-4.5" />
          </Button>
        )}
        <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-xs font-medium">
          <span className="text-zinc-400">DailyOS</span>
          {pathSegments.map((segment, index) => {
            const isLast = index === pathSegments.length - 1;
            

            return (
              <React.Fragment key={segment}>
                <span className="text-zinc-300 dark:text-zinc-700">/</span>
                <span className={isLast ? "text-zinc-900 dark:text-zinc-200" : "text-zinc-400"}>
                  {formatSegment(segment)}
                </span>
              </React.Fragment>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <FocusTimerBar />
        <DropdownMenu open={notifOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger
            className="relative flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 rounded-lg cursor-pointer focus:outline-none"
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white dark:ring-[#0d0d0d]" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-300 text-xs p-0 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
              <DropdownMenuLabel className="p-0 text-xs text-zinc-900 dark:text-white">Notifications</DropdownMenuLabel>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-400"
                >
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loadingNotifs ? (
                <div className="py-8 text-center">
                  <Loader />
                </div>
              ) : notifError ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-red-400">{notifError}</p>
                  <button
                    onClick={reloadNotifications}
                    className="mt-2 text-[11px] font-medium text-blue-500 hover:text-blue-400"
                  >
                    Try again
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <p className="px-3 py-8 text-center text-zinc-400">You&apos;re all caught up.</p>
              ) : (
                notifications.map((n, i) => (
                  <button
                    key={n?.id ?? `notif-${i}`}
                    onClick={() => n?.id && handleNotifClick(n.id, !!n.read)}
                    className={`w-full text-left px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-900 last:border-0 transition-colors ${
                      n?.read ? "opacity-60" : "hover:bg-zinc-100 dark:hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${typeDotColor[n?.type] || "bg-zinc-500"}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{n?.title ?? "Untitled"}</p>
                        <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">{n?.message ?? ""}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Switcher Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 rounded-lg cursor-pointer focus:outline-none"
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-300 text-xs">
            <DropdownMenuItem onClick={() => setTheme("light")} className="hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:bg-zinc-100 dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-white cursor-pointer">
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")} className="hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:bg-zinc-100 dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-white cursor-pointer">
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")} className="hover:bg-zinc-100 dark:hover:bg-zinc-900 focus:bg-zinc-100 dark:focus:bg-zinc-900 focus:text-zinc-900 dark:focus:text-white cursor-pointer">
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
