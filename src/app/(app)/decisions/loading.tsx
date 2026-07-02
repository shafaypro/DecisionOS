import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

// Mirrors decisions/page.tsx (max-w-6xl, header, memory bar, filter row, list).
export default function DecisionsLoading() {
  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-xs" />
          <Skeleton className="h-9 w-36 rounded-xs" />
        </div>
      </div>

      {/* Workspace memory bar */}
      <SkeletonCard className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-xs bg-slate-200" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-10 bg-slate-200" />
              <Skeleton className="h-3 w-20 bg-slate-200" />
            </div>
          </div>
        ))}
      </SkeletonCard>

      {/* Search + filters */}
      <div className="mb-5 flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-xs" />
        <Skeleton className="h-10 w-32 rounded-xs" />
      </div>

      {/* List rows */}
      <SkeletonCard className="divide-y divide-slate-100 p-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3 bg-slate-200" />
              <Skeleton className="h-3 w-full bg-slate-200" />
              <Skeleton className="h-3 w-1/3 bg-slate-200" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full bg-slate-200" />
          </div>
        ))}
      </SkeletonCard>
    </div>
  );
}
