"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import {
  Activity,
  BarChart2,
  Calendar,
  CheckSquare,
  FileText,
  FolderOpen,
  GraduationCap,
  Home,
  PenTool,
  Search,
  Settings,
  Target,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function CommandPalette() {
  const router = useRouter();
  const { isOpen, setOpen, toggleOpen } = useCommandPaletteStore();
  const [query, setQuery] = useState("");

  // Global keybind: Ctrl+K or Cmd+K
  useKeyboardShortcut({ key: "k", ctrlKey: true }, () => {
    toggleOpen();
  });

  // Reset query on close
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  const commands = [
    { name: "Go to Notes", href: "/notes", icon: FileText, category: "Navigation" },
    { name: "Go to Doodle", href: "/doodle", icon: PenTool, category: "Navigation" },
    { name: "Go to Tasks", href: "/tasks", icon: CheckSquare, category: "Navigation" },
    { name: "Go to Projects", href: "/projects", icon: FolderOpen, category: "Navigation" },
    { name: "Go to Calendar", href: "/calendar", icon: Calendar, category: "Navigation" },
    { name: "Go to Developer Mode", href: "/developer", icon: Terminal, category: "Navigation" },
    { name: "Go to Study Mode", href: "/study", icon: GraduationCap, category: "Navigation" },
    { name: "Go to Habits", href: "/habits", icon: Activity, category: "Navigation" },
    { name: "Go to Goals", href: "/goals", icon: Target, category: "Navigation" },
    { name: "Go to Analytics", href: "/analytics", icon: BarChart2, category: "Navigation" },
    { name: "Go to Settings", href: "/settings", icon: Settings, category: "Navigation" },
  ];

  const filteredCommands = query
    ? commands.filter((cmd) => cmd.name.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl border border-zinc-800 bg-[#0C0C0E]/90 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
        <div className="flex items-center border-b border-zinc-800 px-4 py-3">
          <Search className="h-4.5 w-4.5 text-zinc-500 mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
            autoFocus
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-zinc-800 bg-zinc-950 px-1.5 font-mono text-[9px] font-medium text-zinc-500">
            ESC
          </kbd>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-2">
              <div className="px-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                {query ? "Search Results" : "Suggestions"}
              </div>
              <div className="space-y-0.5">
                {filteredCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.name}
                      onClick={() => handleSelect(cmd.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-400",
                        "hover:bg-zinc-900 hover:text-white hover:border-zinc-800 transition-colors"
                      )}
                    >
                      <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
                      <span>{cmd.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-500">
          <span>Use arrow keys to navigate, Enter to select</span>
          <span>Press ESC to close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
