"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";
import { HelpCircle, Search } from "lucide-react";
import { TEXT_COLOR, TEXT_SIZE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { SEARCH_SYNTAX_HELP } from "@/lib/search-query";

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
        placeholder="Search, or filter with status: owner: tag: impact: is:"
        className={cn(
          "h-9 w-full rounded-xs bg-white pl-9 pr-10 shadow-soft placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-blue-500",
          TEXT_SIZE.sm,
          TEXT_COLOR.primary,
        )}
      />

      {/* Syntax cheatsheet. `<details>` keeps this a zero-state popover - no
          click-outside handling, and it closes with Esc for free. */}
      <details className="group absolute right-2 top-1/2 -translate-y-1/2">
        <summary
          aria-label="Search syntax help"
          className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-xs text-slate-400 hover:text-slate-600 [&::-webkit-details-marker]:hidden"
        >
          <HelpCircle className="h-4 w-4" />
        </summary>
        <div className="absolute right-0 z-30 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-xs border border-slate-200 bg-white p-3 shadow-lg">
          <p className={cn("pb-2", TEXT_SIZE.xs, TEXT_COLOR.secondary)}>
            Combine filters and free text. Filters are ANDed; repeating one ORs its values.
          </p>
          <dl className="space-y-1.5">
            {SEARCH_SYNTAX_HELP.map((row) => (
              <div key={row.example} className="flex gap-3">
                <dt className="w-40 shrink-0">
                  <code className={cn("rounded-xs bg-slate-100 px-1 py-0.5 font-mono", TEXT_SIZE["2xs"])}>
                    {row.example}
                  </code>
                </dt>
                <dd className={cn(TEXT_SIZE["2xs"], TEXT_COLOR.muted)}>{row.meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </div>
  );
}
