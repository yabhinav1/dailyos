import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DeletionGuard from "@/components/account/deletion-guard";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import CommandPalette from "@/components/layout/command-palette";
import GuestNotesImporter from "@/components/notes/guest-notes-importer";
import MusicPlayerWidget from "@/components/music/music-player-widget";

import MobileNavBar from "@/components/layout/mobile-nav-bar";

// The authoritative auth check for every dashboard route. proxy.ts only does
// an optimistic cookie check, which a forged or expired cookie would pass —
// this resolves the real session before any page renders.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Signing in during the deletion grace period has to be answered before the
  // workspace is usable, so the check lives here rather than on one page.
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { deletionScheduledAt: true },
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-[#0d0d0d] text-foreground">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main content pane */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden pb-12 md:pb-0">
        {/* Top bar header */}
        <Header />

        {/* Scrollable body content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Navigation Bar */}
      <MobileNavBar />

      {/* Cmd + K Command Palette */}
      <CommandPalette />

      {/* One-time migration of any guest-mode notes saved on this device */}
      <GuestNotesImporter />

      {/* Floating music player — hovers over every dashboard page */}
      <MusicPlayerWidget />

      {account?.deletionScheduledAt && (
        <DeletionGuard deletesAt={account.deletionScheduledAt.toISOString()} />
      )}
    </div>
  );
}
