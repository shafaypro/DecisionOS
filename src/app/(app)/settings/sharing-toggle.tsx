"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";

/** Admin switch for public read-only links across the workspace. */
export function SharingToggle({ enabled, sharedCount }: { enabled: boolean; sharedCount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    if (!next && sharedCount > 0) {
      const ok = confirm(
        `Turn off public links? The ${sharedCount} existing link${sharedCount === 1 ? "" : "s"} will stop working immediately, and turning this back on won't restore ${sharedCount === 1 ? "it" : "them"}.`,
      );
      if (!ok) return;
    }
    setOn(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings/sharing", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicSharing: next }),
        });
        const data = (await res.json().catch(() => ({}))) as { success?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
        toast.success(data.success ?? "Saved");
        router.refresh();
      } catch (err) {
        setOn(!next);
        toast.error((err as Error).message || "Could not save.");
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Text as="p" weight="medium">Public read-only links</Text>
        <Text as="p" size="sm" color="muted">
          {on
            ? `Members can create a link that shows one decision to people outside the workspace. ${sharedCount} decision${sharedCount === 1 ? " is" : "s are"} shared right now.`
            : "Off. Nobody can create public links, and every decision stays inside the workspace."}
        </Text>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Allow public read-only links"
        disabled={pending}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${
          on ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}
