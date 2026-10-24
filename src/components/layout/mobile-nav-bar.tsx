"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, CheckSquare, GraduationCap, FolderKanban, Settings, Sun } from "lucide-react";

export default function MobileNavBar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Today", href: "/today", icon: Sun },
    { label: "Notes", href: "/notes", icon: FileText },
    { label: "Tasks", href: "/tasks", icon: CheckSquare },
    { label: "Projects", href: "/projects", icon: FolderKanban },
    { label: "Study", href: "/study", icon: GraduationCap },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 block md:hidden border-t border-zinc-800 bg-[#0d0d0d]/95 backdrop-blur-md px-2 py-1.5 shadow-2xl">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors ${
                isActive ? "text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-white" : ""}`} />
              <span className="text-[11px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
