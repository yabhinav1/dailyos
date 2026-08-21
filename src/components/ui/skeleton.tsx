import { cn } from "@/lib/utils";

/**
 * Placeholder block for content that hasn't arrived. Prefer these over a
 * spinner wherever the final layout is known: reserving the real shape stops
 * the page jumping when data lands.
 *
 * The wrappers below cover the shapes this app repeats — a list of rows, a
 * grid of cards, a row of stat tiles. Reach for the bare `Skeleton` for
 * anything one-off.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800/70",
        className
      )}
    />
  );
}

/** Wraps a skeleton group so screen readers announce the wait once. */
function SkeletonRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-label={label} className={className}>
      {children}
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <SkeletonRegion label="Loading" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-900"
        >
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-[38%]" />
            <Skeleton className="h-2.5 w-[62%]" />
          </div>
          <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function SkeletonCards({ cards = 6 }: { cards?: number }) {
  return (
    <SkeletonRegion
      label="Loading"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: cards }, (_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-900"
        >
          <Skeleton className="h-4 w-[55%]" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-[70%]" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function SkeletonStats({ tiles = 4 }: { tiles?: number }) {
  return (
    <SkeletonRegion
      label="Loading"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {Array.from({ length: tiles }, (_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-900"
        >
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </SkeletonRegion>
  );
}
