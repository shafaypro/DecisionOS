"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, Circle, X } from "lucide-react";
import { Text } from "@/components/ui/text";

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  href?: string;
  cta?: string;
}

interface Props {
  workspaceId: string;
  items: ChecklistItem[];
}

/**
 * First-run onboarding checklist. Shows until every item is done or the user
 * dismisses it. Stored per-workspace in localStorage so it doesn't follow
 * users across workspaces they join.
 */
export function OnboardingChecklist({ workspaceId, items }: Props) {
  const storageKey = `decisionos:onboarding-dismissed:${workspaceId}`;
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange);
    window.addEventListener("decisionos:onboarding-dismissed", onStoreChange);

    return () => {
      window.removeEventListener("storage", onStoreChange);
      window.removeEventListener("decisionos:onboarding-dismissed", onStoreChange);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    return localStorage.getItem(storageKey) === "1";
  }, [storageKey]);

  const hidden = useSyncExternalStore(subscribe, getSnapshot, () => true);

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = completed === total;

  if (hidden || allDone) return null;

  function dismiss() {
    localStorage.setItem(storageKey, "1");
    window.dispatchEvent(new Event("decisionos:onboarding-dismissed"));
  }

  const percent = Math.round((completed / total) * 100);

  return (
    <div className="mb-6 rounded-xs border border-blue-200 bg-blue-50 p-5 relative">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-700"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <Text as="h3">Get set up in 5 minutes</Text>
          <Text as="p">
            {completed} of {total} done · {percent}%
          </Text>
        </div>
      </div>
      <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            {item.done ? (
              <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-slate-300 flex-shrink-0" />
            )}
            <Text>
              {item.label}
            </Text>
            {!item.done && item.href && item.cta && (
              <Link href={item.href} className="ml-auto hover:text-text-brand">
                <Text>{item.cta} →</Text>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
