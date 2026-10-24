import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { resolveProjectAccess } from "@/lib/note-access";
import { getSharedProjectAction } from "@/features/projects/share-actions";
import SharedProjectView from "@/features/projects/components/shared-project-view";

// Someone's private project: never indexed, never cached.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared project · DailyOS",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await resolveProjectAccess(token);

  if (access.status === "not-found") notFound();
  if (access.status === "sign-in") redirect(`/login?callbackUrl=${encodeURIComponent(`/p/${token}`)}`);
  if (access.status === "no-access") {
    return (
      <main className="min-h-screen grid place-items-center bg-[#0d0d0d] px-4 text-zinc-200">
        <div className="max-w-sm text-center space-y-3">
          <Lock className="h-8 w-8 mx-auto text-zinc-500" />
          <h1 className="text-lg font-bold text-white">You need access</h1>
          <p className="text-sm text-zinc-400">
            You&apos;re signed in as <span className="text-zinc-200">{access.email}</span>, which this project isn&apos;t
            shared with. Ask the owner to share it with that address, or sign in with the one they used.
          </p>
          <Link href="/today" className="inline-block text-sm text-blue-400 hover:text-blue-300">
            Go to DailyOS
          </Link>
        </div>
      </main>
    );
  }

  const initial = await getSharedProjectAction(token);
  if (!initial.success) notFound();

  return <SharedProjectView token={token} initial={initial.data} />;
}
