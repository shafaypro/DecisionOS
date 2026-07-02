"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORIES, STATUSES, OUTCOME_STATUSES, IMPACT_LEVELS, cn } from "@/lib/utils";
import { TEXT_COLOR, TEXT_SIZE } from "@/lib/typography";
import { Search, X } from "lucide-react";

interface Member {
  id: string;
  name: string;
}

interface FilterProps {
  members: Member[];
  currentParams: {
    status?: string;
    category?: string;
    outcome?: string;
    impact?: string;
    owner?: string;
    q?: string;
  };
}

export function DecisionsFilter({ members, currentParams }: FilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams();
      const current = { ...currentParams };
      if (value) {
        (current as Record<string, string>)[key] = value;
      } else {
        delete (current as Record<string, string>)[key];
      }
      Object.entries(current).forEach(([k, v]) => {
        if (v) params.set(k, v as string);
      });
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [currentParams, pathname, router]
  );

  const clearAll = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasFilters = Object.values(currentParams).some(Boolean);

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search decisions…"
            className="pl-9"
            defaultValue={currentParams.q}
            onChange={(e) => updateParam("q", e.target.value)}
          />
        </div>

        {/* Status */}
        <select
          className={cn(
            "h-9 rounded-xs bg-white px-3 py-1 shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500",
            TEXT_SIZE.sm,
            TEXT_COLOR.secondary,
          )}
          value={currentParams.status ?? ""}
          onChange={(e) => updateParam("status", e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Category */}
        <select
          className={cn(
            "h-9 rounded-xs bg-white px-3 py-1 shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500",
            TEXT_SIZE.sm,
            TEXT_COLOR.secondary,
          )}
          value={currentParams.category ?? ""}
          onChange={(e) => updateParam("category", e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Outcome */}
        <select
          className={cn(
            "h-9 rounded-xs bg-white px-3 py-1 shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500",
            TEXT_SIZE.sm,
            TEXT_COLOR.secondary,
          )}
          value={currentParams.outcome ?? ""}
          onChange={(e) => updateParam("outcome", e.target.value)}
        >
          <option value="">All Outcomes</option>
          {OUTCOME_STATUSES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Impact */}
        <select
          className={cn(
            "h-9 rounded-xs bg-white px-3 py-1 shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500",
            TEXT_SIZE.sm,
            TEXT_COLOR.secondary,
          )}
          value={currentParams.impact ?? ""}
          onChange={(e) => updateParam("impact", e.target.value)}
        >
          <option value="">All Impact Levels</option>
          {IMPACT_LEVELS.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>

        {/* Owner */}
        <select
          className={cn(
            "h-9 rounded-xs bg-white px-3 py-1 shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500",
            TEXT_SIZE.sm,
            TEXT_COLOR.secondary,
          )}
          value={currentParams.owner ?? ""}
          onChange={(e) => updateParam("owner", e.target.value)}
        >
          <option value="">All Owners</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={isPending}>
            <X className="h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
