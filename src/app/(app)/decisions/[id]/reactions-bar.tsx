"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp, ThumbsDown, Eye, AlertTriangle, Rocket, HelpCircle, Smile } from "lucide-react";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";

/**
 * Inline emoji reaction bar on a decision. Shows totals + who reacted, lets
 * the current user toggle their own reactions. Server-component caller passes
 * pre-grouped reactions + the current user's id so we can render without a
 * round-trip, then we POST to toggle and router.refresh() to re-read.
 */

export type ReactionRow = {
  emoji: string;
  user: { id: string; name: string };
};

const EMOJIS = [
  { key: "thumbsup",   label: "Agree",      icon: ThumbsUp,      color: "text-emerald-600" },
  { key: "thumbsdown", label: "Disagree",   icon: ThumbsDown,    color: "text-rose-600" },
  { key: "eyes",       label: "Watching",   icon: Eye,           color: "text-blue-600" },
  { key: "warning",    label: "Concern",    icon: AlertTriangle, color: "text-amber-600" },
  { key: "rocket",     label: "Shipping",   icon: Rocket,        color: "text-fuchsia-600" },
  { key: "question",   label: "Question",   icon: HelpCircle,    color: "text-slate-500" },
] as const;

export function ReactionsBar({
  decisionId,
  initialReactions,
  currentUserId,
  readOnly = false,
}: {
  decisionId: string;
  initialReactions: ReactionRow[];
  currentUserId: string;
  readOnly?: boolean;
}) {
  const [reactions, setReactions] = useState(initialReactions);
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();

  function toggle(emoji: string) {
    if (readOnly) return;
    // Optimistic: flip locally, then reconcile with server.
    const previous = reactions;
    const mine = reactions.find((r) => r.emoji === emoji && r.user.id === currentUserId);
    const next = mine
      ? reactions.filter((r) => !(r.emoji === emoji && r.user.id === currentUserId))
      : [...reactions, { emoji, user: { id: currentUserId, name: "You" } }];
    setReactions(next);
    setPickerOpen(false);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/decisions/${decisionId}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });
        if (!res.ok) {
          setReactions(previous);
          toast.error("Couldn't update reaction. Please try again.");
          return;
        }
        router.refresh();
      } catch {
        setReactions(previous);
        toast.error("Network error updating reaction.");
      }
    });
  }

  // Group reactions by emoji → user list
  const grouped = EMOJIS.map((meta) => {
    const rows = reactions.filter((r) => r.emoji === meta.key);
    const mine = rows.some((r) => r.user.id === currentUserId);
    return { ...meta, rows, mine, count: rows.length };
  }).filter((g) => g.count > 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {grouped.map((g) => {
        const Icon = g.icon;
        const names = g.rows.map((r) => (r.user.id === currentUserId ? "You" : r.user.name)).join(", ");
        return (
          <button
            key={g.key}
            type="button"
            disabled={readOnly || isPending}
            onClick={() => toggle(g.key)}
            title={`${g.label} · ${names}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors ${
              g.mine
                ? "border-blue-300 bg-blue-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <Icon className={`h-3.5 w-3.5 ${g.mine ? "" : g.color}`} />
            <Text>{g.count}</Text>
          </button>
        );
      })}

      {!readOnly && (
        <div className="relative">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1 hover:bg-slate-50 disabled:opacity-60"
          >
            <Smile className="h-3.5 w-3.5 text-slate-500" />
            <Text>React</Text>
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 flex gap-1 rounded-xs bg-white p-1.5 shadow-soft">
                {EMOJIS.map((meta) => {
                  const Icon = meta.icon;
                  const mine = reactions.some((r) => r.emoji === meta.key && r.user.id === currentUserId);
                  return (
                    <button
                      key={meta.key}
                      type="button"
                      onClick={() => toggle(meta.key)}
                      title={meta.label}
                      className={`flex h-7 w-7 items-center justify-center rounded-xs transition-colors ${
                        mine ? "bg-blue-50" : "hover:bg-slate-100"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
