import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Use to mirror a page's real layout inside a `loading.tsx`
 * so the skeleton streams instantly on navigation and the content swaps in with
 * no layout shift. Compose several with explicit width/height classes.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xs bg-slate-200/70", className)}
      {...props}
    />
  );
}

/** Convenience: a card-shaped skeleton block matching the app's Card radius/border. */
export function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xs/80 bg-white/60 p-5",
        className,
      )}
      {...props}
    />
  );
}
