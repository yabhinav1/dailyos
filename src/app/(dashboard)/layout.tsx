import React from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import CommandPalette from "@/components/layout/command-palette";
import GuestNotesImporter from "@/components/notes/guest-notes-importer";
import MusicPlayerWidget from "@/components/music/music-player-widget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-[#0d0d0d] text-foreground">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main content pane */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar header */}
        <Header />

        {/* Scrollable body content */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Cmd + K Command Palette */}
      <CommandPalette />

      {/* One-time migration of any guest-mode notes saved on this device */}
      <GuestNotesImporter />

      {/* Floating music player — hovers over every dashboard page */}
      <MusicPlayerWidget />
    </div>
  );
}
