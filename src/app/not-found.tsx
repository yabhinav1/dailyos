import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-white dark:bg-[#0d0d0d] text-center px-6">
      <FileQuestion className="h-12 w-12 text-zinc-200 dark:text-zinc-700" />
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Page not found</h1>
      <p className="max-w-sm text-sm text-zinc-400">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link
        href="/today"
        className="mt-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 transition-colors"
      >
        Back to DailyOS
      </Link>
    </div>
  );
}
