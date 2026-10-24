"use client";

import React from "react";
import { Priority, TaskStatus } from "@prisma/client";
import { Search, X, SlidersHorizontal, ArrowUpDown, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

interface TaskFiltersProps {
  search: string;
  setSearch: (val: string) => void;
  status: TaskStatus | "ALL";
  setStatus: (val: TaskStatus | "ALL") => void;
  priority: Priority | "ALL";
  setPriority: (val: Priority | "ALL") => void;
  sortBy: "dueDate" | "priority" | "createdAt";
  setSortBy: (val: "dueDate" | "priority" | "createdAt") => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (val: "asc" | "desc") => void;
  tag: string;
  setTag: (val: string) => void;
  tags: string[];
}

export default function TaskFilters({
  search,
  setSearch,
  status,
  setStatus,
  priority,
  setPriority,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  tag,
  setTag,
  tags,
}: TaskFiltersProps) {
  const hasActiveFilters = search !== "" || status !== "ALL" || priority !== "ALL" || tag !== "";

  const clearFilters = () => {
    setSearch("");
    setStatus("ALL");
    setPriority("ALL");
    setTag("");
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">
      {/* Search Input */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-8 bg-zinc-900/40 border-zinc-800 focus:border-zinc-700 text-xs text-white"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Action Filters and Sorters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 text-xs text-zinc-200 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer focus:outline-none">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Status: {status === "ALL" ? "All" : status}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#171717] border border-zinc-850 text-zinc-300 text-xs">
            <DropdownMenuLabel className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">Filter Status</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-850" />
            <DropdownMenuCheckboxItem
              checked={status === "ALL"}
              onCheckedChange={() => setStatus("ALL")}
              className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer"
            >
              All statuses
            </DropdownMenuCheckboxItem>
            {Object.values(TaskStatus).map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={status === s}
                onCheckedChange={() => setStatus(s)}
                className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer"
              >
                {s.replace("_", " ")}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 text-xs text-zinc-200 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer focus:outline-none">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Priority: {priority === "ALL" ? "All" : priority}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#171717] border border-zinc-850 text-zinc-300 text-xs">
            <DropdownMenuLabel className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">Filter Priority</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-850" />
            <DropdownMenuCheckboxItem
              checked={priority === "ALL"}
              onCheckedChange={() => setPriority("ALL")}
              className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer"
            >
              All priorities
            </DropdownMenuCheckboxItem>
            {Object.values(Priority).map((p) => (
              <DropdownMenuCheckboxItem
                key={p}
                checked={priority === p}
                onCheckedChange={() => setPriority(p)}
                className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer"
              >
                {p}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tag Filter */}
        {tags.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 text-xs text-zinc-200 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer focus:outline-none">
              <Hash className="h-3.5 w-3.5" />
              <span>Tag: {tag || "All"}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#171717] border border-zinc-850 text-zinc-300 text-xs max-h-72 overflow-y-auto">
              <DropdownMenuLabel className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">Filter Tag</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-850" />
              <DropdownMenuCheckboxItem
                checked={tag === ""}
                onCheckedChange={() => setTag("")}
                className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer"
              >
                All tags
              </DropdownMenuCheckboxItem>
              {tags.map((t) => (
                <DropdownMenuCheckboxItem
                  key={t}
                  checked={tag === t}
                  onCheckedChange={() => setTag(t)}
                  className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer"
                >
                  #{t}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Sorting Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 text-xs text-zinc-200 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer focus:outline-none">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>Sort</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#171717] border border-zinc-850 text-zinc-300 text-xs">
            <DropdownMenuLabel className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">Sort By</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-850" />
            <DropdownMenuRadioGroup value={sortBy} onValueChange={(val) => setSortBy(val as "dueDate" | "priority" | "createdAt")}>
              <DropdownMenuRadioItem value="createdAt" className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer">
                Creation date
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dueDate" className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer">
                Due date
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="priority" className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer">
                Priority
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            
            <DropdownMenuSeparator className="bg-zinc-855" />
            
            <DropdownMenuLabel className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">Sort Order</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sortOrder} onValueChange={(val) => setSortOrder(val as "asc" | "desc")}>
              <DropdownMenuRadioItem value="asc" className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer">
                Ascending
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc" className="hover:bg-zinc-900 focus:bg-zinc-900 focus:text-white cursor-pointer">
                Descending
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear Filters Trigger */}
        {hasActiveFilters && (
          <Button
            onClick={clearFilters}
            variant="ghost"
            className="h-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 text-xs px-2.5 rounded-lg border border-transparent hover:border-red-500/20"
          >
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
