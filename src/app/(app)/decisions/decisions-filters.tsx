"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { STATUSES, cn } from "@/lib/utils";
import { TEXT_COLOR, TEXT_SIZE } from "@/lib/typography";

interface Member {
  user: { id: string; name: string };
}

interface DecisionsFiltersProps {
  members: Member[];
  currentStatus?: string;
  currentOwner?: string;
  hasFilters: boolean;
}

export function DecisionsFilters({
  members,
  currentStatus,
  currentOwner,
  hasFilters,
}: DecisionsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex gap-2">
      <select
        value={currentStatus ?? ""}
        onChange={(e) => handleChange("status", e.target.value)}
        aria-label="Filter by status"
        className={cn(
          "h-9 rounded-xs bg-white px-3 shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500",
          TEXT_SIZE.sm,
          TEXT_COLOR.secondary,
        )}
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select
        value={currentOwner ?? ""}
        onChange={(e) => handleChange("owner", e.target.value)}
        aria-label="Filter by owner"
        className={cn(
          "h-9 rounded-xs bg-white px-3 shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500",
          TEXT_SIZE.sm,
          TEXT_COLOR.secondary,
        )}
      >
        <option value="">All owners</option>
        {members.map((m) => (
          <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
        ))}
      </select>

      {hasFilters && (
        <Button variant="ghost" size="sm" asChild>
          <Link href="/decisions">
            Clear
          </Link>
        </Button>
      )}
    </div>
  );
}
