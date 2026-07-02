"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { ACTIVITY_EVENT_TYPES, activityEventLabel } from "@/lib/activity-events";

/**
 * Filter bar for the activity feed: pick an event type and/or a member. Changing
 * a filter updates the URL search params (and resets to page 1) so the server
 * page re-queries.
 */
export function ActivityFilters({ members }: { members: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <NativeSelect
        aria-label="Filter by event"
        className="w-52"
        value={params.get("type") ?? ""}
        onChange={(e) => update("type", e.target.value)}
      >
        <option value="">All events</option>
        {ACTIVITY_EVENT_TYPES.map((t) => (
          <option key={t} value={t}>{activityEventLabel(t)}</option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="Filter by member"
        className="w-52"
        value={params.get("user") ?? ""}
        onChange={(e) => update("user", e.target.value)}
      >
        <option value="">All members</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </NativeSelect>
    </div>
  );
}
