"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import {
  Activity,
  BarChart2,
  Calendar,
  CheckSquare,
  FileText,
  FolderOpen,
  GraduationCap,
  Loader2,
  PenTool,
  Plus,
  Search,
  Settings,
  Sun,
  Target,
  Terminal,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { searchEverything, type SearchHit } from "@/features/search/actions";
import { createTask } from "@/features/tasks/actions";
import { toast } from "@/stores/toast-store";

type Item = {
  id: string;
  group: string;
  label: string;
  detail?: string | null;
  icon: React.ElementType;
  run: () => void;
};

const NAV = [
  { name: "Today", href: "/today", icon: Sun },
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
  { name: "Trash", href: "/trash", icon: Trash2 },
  { name: "Settings", href: "/settings", icon: Settings },
];

const KIND_META: Record<SearchHit["kind"], { group: string; icon: React.ElementType }> = {
  note: { group: "Notes", icon: FileText },
  task: { group: "Tasks", icon: CheckSquare },
  project: { group: "Projects", icon: FolderOpen },
  goal: { group: "Goals", icon: Target },
  event: { group: "Events", icon: Calendar },
  habit: { group: "Habits", icon: Activity },
};

function hitDetail(hit: SearchHit) {
  if (hit.kind === "event" && hit.detail) {
    return new Date(hit.detail).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return hit.detail;
}

export default function CommandPalette() {
  const router = useRouter();
  const { isOpen, setOpen, toggleOpen } = useCommandPaletteStore();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Global keybind: Ctrl+K or Cmd+K
  useKeyboardShortcut({ key: "k", ctrlKey: true }, () => {
    toggleOpen();
  });
  // Reset when the palette closes, adjusting state during render instead of
  // from an effect (avoids an extra cascading render).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setQuery("");
      setHits([]);
      setActive(0);
    }
  }

  const trimmed = query.trim();

  // Debounced so a search runs once typing pauses, and a stale response
  // never replaces a newer one.
  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await searchEverything(trimmed);
      if (cancelled) return;
      setHits(res.data ?? []);
      setSearching(false);
      setActive(0);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setSearching(false);
    };
  }, [trimmed]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const items: Item[] = useMemo(() => {
    const q = trimmed.toLowerCase();
    const nav = NAV.filter((n) => !q || n.name.toLowerCase().includes(q)).map<Item>((n) => ({
      id: `nav:${n.href}`,
      group: "Go to",
      label: n.name,
      icon: n.icon,
      run: () => go(n.href),
    }));
    if (trimmed.length < 2) return nav;

    const found = hits.map<Item>((h) => ({
      id: `${h.kind}:${h.id}`,
      group: KIND_META[h.kind].group,
      label: h.title,
      detail: hitDetail(h),
      icon: KIND_META[h.kind].icon,
      run: () => go(h.href),
    }));
    const create: Item = {
      id: "create-task",
      group: "Actions",
      label: `Create task "${trimmed}"`,
      icon: Plus,
      run: async () => {
        setOpen(false);
        try {
          await createTask({ title: trimmed });
          toast.success(`Task "${trimmed}" created.`, { label: "Open", onClick: () => router.push("/tasks") });
        } catch {
          toast.error("Couldn't create the task.");
        }
      },
    };
    return [...found, ...nav, create];
    // go/router/setOpen are stable for the palette's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, hits]);

  // Keep the highlighted row in range and in view.
  const activeIndex = Math.min(active, Math.max(0, items.length - 1));
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((activeIndex + 1) % Math.max(1, items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((activeIndex - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[activeIndex]?.run();
    }
  };

  // Rows grouped under headings, keeping each item's flat index for the keys.
  const groups: { name: string; rows: { item: Item; index: number }[] }[] = [];
  items.forEach((item, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.rows.push({ item, index });
    else groups.push({ name: item.group, rows: [{ item, index }] });
  });

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl border border-zinc-800 bg-[#0C0C0E]/90 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
        <DialogTitle className="sr-only">Search and commands</DialogTitle>
        <div className="flex items-center border-b border-zinc-800 px-4 py-3">
          {searching ? (
            <Loader2 className="h-4.5 w-4.5 text-zinc-400 mr-3 shrink-0 animate-spin" />
          ) : (
            <Search className="h-4.5 w-4.5 text-zinc-400 mr-3 shrink-0" />
          )}
          <input
            type="text"
            placeholder="Search notes, tasks, projects… or jump to a page"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={items[activeIndex] ? `cmd-${activeIndex}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              if (e.target.value.trim().length < 2) setHits([]);
            }}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent text-sm text-white placeholder-zinc-400 outline-none"
            autoFocus
          />
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-zinc-800 bg-zinc-950 px-1.5 font-mono text-[11px] font-medium text-zinc-400">
            ESC
          </kbd>
        </div>

        <div ref={listRef} id="command-palette-list" role="listbox" className="max-h-[360px] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-400">No results for &ldquo;{query}&rdquo;</div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.name} className="space-y-0.5">
                  <div className="px-2 pt-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{g.name}</div>
                  {g.rows.map(({ item, index }) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        id={`cmd-${index}`}
                        data-index={index}
                        role="option"
                        aria-selected={index === activeIndex}
                        onClick={item.run}
                        onMouseMove={() => index !== activeIndex && setActive(index)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-300 transition-colors",
                          index === activeIndex && "bg-zinc-900 text-white"
                        )}
                      >
                        <Icon className="h-4 w-4 text-zinc-400 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {item.detail && <span className="ml-auto pl-3 truncate max-w-[50%] text-[11px] text-zinc-500">{item.detail}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2 text-[11px] text-zinc-400">
          <span>↑↓ to navigate · Enter to open</span>
          <span>Esc to close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
