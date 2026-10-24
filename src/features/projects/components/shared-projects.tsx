"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { getProjectsSharedWithMeAction } from "@/features/projects/share-actions";

type Item = Awaited<ReturnType<typeof getProjectsSharedWithMeAction>>["data"][number];

/** Projects other people have shared with you; each opens via its link. */
export default function SharedProjects() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    getProjectsSharedWithMeAction().then((res) => {
      if (!cancelled && res.success) setItems(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
        <Users className="h-3.5 w-3.5" /> Shared with me
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <Link
            key={p.token}
            href={`/p/${p.token}`}
            className="rounded-xl border border-zinc-850 bg-[#0C0C0E]/40 p-4 hover:border-zinc-700 transition-colors"
          >
            <p className={`text-sm font-semibold text-zinc-100 truncate ${p.isCompleted ? "line-through text-zinc-400" : ""}`}>{p.name}</p>
            <p className="mt-1 text-[11px] text-zinc-400 truncate">
              {p.owner} · {p.role === "EDIT" ? "Editor" : "Viewer"} · {p.taskCount} task{p.taskCount === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
