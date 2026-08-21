import { cn } from "@/lib/utils";

const sizeMap = {
  sm: "h-1.5 w-1.5",
  default: "h-2 w-2",
  lg: "h-2.5 w-2.5",
};

/**
 * Three bouncing dots — used anywhere the app needs a loading indicator
 * instead of the plain spinning-ring.
 */
export function Loader({
  size = "default",
  className,
}: {
  size?: keyof typeof sizeMap;
  className?: string;
}) {
  const dot = cn("rounded-full bg-blue-500 animate-bounce", sizeMap[size]);
  return (
    <div
      className={cn("inline-flex flex-row items-center justify-center gap-1.5", className)}
      role="status"
      aria-label="Loading"
    >
      <div className={dot} style={{ animationDelay: "0ms" }} />
      <div className={dot} style={{ animationDelay: "150ms" }} />
      <div className={dot} style={{ animationDelay: "300ms" }} />
    </div>
  );
}

/** Full-height centered variant for empty/loading page states. */
export function LoaderBlock({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16", className)}>
      <Loader />
      {label && <p className="text-xs text-zinc-400">{label}</p>}
    </div>
  );
}
