"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-white dark:bg-[#0d0d0d] text-center px-6">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Something went wrong</h1>
      <p className="max-w-sm text-sm text-zinc-500">
        An unexpected error occurred. You can try again, or head back and pick up where you left off.
      </p>
      <button
        onClick={() => reset()}
        className="mt-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
