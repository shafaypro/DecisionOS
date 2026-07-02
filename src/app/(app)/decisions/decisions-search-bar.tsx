"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";
import { Search } from "lucide-react";
import { TEXT_COLOR, TEXT_SIZE } from "@/lib/typography";
import { cn } from "@/lib/utils";

export function DecisionsSearchBar({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (val) {
        params.set("q", val);
      } else {
        params.delete("q");
      }
      startTransition(() => {
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    }, 250);
  }

  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        onChange={handleChange}
        placeholder="Search title, rationale, problem, or Solution"
        className={cn(
          "h-9 w-full rounded-xs bg-white pl-9 pr-3 shadow-soft placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-blue-500",
          TEXT_SIZE.sm,
          TEXT_COLOR.primary,
        )}
      />
    </div>
  );
}
