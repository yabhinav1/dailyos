"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { getNotesSharedWithMeAction } from "@/features/notes/share-actions";

type Item = Awaited<ReturnType<typeof getNotesSharedWithMeAction>>["data"][number];

/** Notes other people shared with you; each opens through its share link. */
export default function SharedWithMe() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    getNotesSharedWithMeAction().then((res) => {
      if (!cancelled && res.success) setItems(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pt-2 pb-1">
      <div className="px-2.5 mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
        <Users className="h-3 w-3" /> Shared with me
      </div>
      {items.map((item) => (
        <Link
          key={item.token}
          href={`/s/${item.token}`}
          className="block px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900/60 hover:text-zinc-100"
          title={`${item.owner} · ${item.role === "EDIT" ? "can edit" : "view only"}`}
        >
          <span className="block truncate font-medium">{item.title}</span>
          <span className="block truncate text-[11px] text-zinc-500">
            {item.owner} · {item.role === "EDIT" ? "Editor" : "Viewer"}
          </span>
        </Link>
      ))}
    </div>
  );
}
