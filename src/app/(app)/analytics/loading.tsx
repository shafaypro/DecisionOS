import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

// Mirrors analytics/page.tsx (max-w-6xl, header, 6 stat cards, 2-col card grid).
export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xs" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="h-24 space-y-2">
            <Skeleton className="h-6 w-12 bg-slate-200" />
            <Skeleton className="h-3 w-16 bg-slate-200" />
          </SkeletonCard>
        ))}
      </div>

      {/* Two-column detail cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i} className="h-64">
            <Skeleton className="mb-4 h-4 w-40 bg-slate-200" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((__, j) => (
                <Skeleton key={j} className="h-3 w-full bg-slate-200" />
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
