/**
 * Decision health - a product-specific signal unique to DecisionOS.
 *
 * The core thesis of the product is "teams forget why and assumptions quietly
 * break." Health gives us a single derived status per decision that surfaces
 * exactly that failure mode. It is computed, not stored - so there's nothing
 * to migrate and no drift between the badge and the underlying data.
 *
 * Precedence (first match wins):
 *
 *   1. superseded-unreviewed - status=superseded but no review ever submitted.
 *      A decision has been replaced but nobody captured *why* the first one
 *      broke. This is the most expensive failure mode.
 *   2. review-overdue        - reviewDate has passed and reviewedAt is null.
 *   3. review-due-soon       - reviewDate is within the next 7 days.
 *   4. stale                 - active decision with no reviewDate set and no
 *      edits in 90+ days. Nobody's thinking about it.
 *   5. orphaned              - active decision with no owner assigned.
 *      No accountability → most likely to rot.
 *   6. archived / superseded - neutral, informational only.
 *   7. healthy               - everything else.
 *
 * Thresholds are exported so callers can reuse them (cron, digests).
 */

export const HEALTH_THRESHOLDS = {
  REVIEW_DUE_SOON_DAYS: 7,
  STALE_DAYS: 90,
} as const;

export type DecisionHealth =
  | "healthy"
  | "review-due-soon"
  | "review-overdue"
  | "stale"
  | "orphaned"
  | "superseded-unreviewed"
  | "superseded"
  | "archived";

export interface DecisionHealthInput {
  status: string;
  ownerUserId: string | null;
  reviewDate: Date | null;
  reviewedAt: Date | null;
  updatedAt: Date;
  reviewCount?: number;
}

export function computeDecisionHealth(d: DecisionHealthInput, now: Date = new Date()): DecisionHealth {
  if (d.status === "superseded") {
    if (!d.reviewedAt && (d.reviewCount ?? 0) === 0) return "superseded-unreviewed";
    return "superseded";
  }
  if (d.status === "archived") return "archived";

  if (d.reviewDate && !d.reviewedAt) {
    const review = d.reviewDate.getTime();
    const nowMs = now.getTime();
    if (review < nowMs) return "review-overdue";
    const soon = HEALTH_THRESHOLDS.REVIEW_DUE_SOON_DAYS * 24 * 60 * 60 * 1000;
    if (review - nowMs <= soon) return "review-due-soon";
  }

  // Stale: no review set, no edits in STALE_DAYS
  if (!d.reviewDate) {
    const stale = HEALTH_THRESHOLDS.STALE_DAYS * 24 * 60 * 60 * 1000;
    if (now.getTime() - d.updatedAt.getTime() > stale) return "stale";
  }

  if (!d.ownerUserId) return "orphaned";

  return "healthy";
}

export const HEALTH_META: Record<DecisionHealth, { label: string; hint: string; tone: string; dot: string }> = {
  healthy: {
    label: "Healthy",
    hint: "Reviewed on schedule and has an owner.",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  "review-due-soon": {
    label: "Review due soon",
    hint: "Review is scheduled within the next 7 days.",
    tone: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  "review-overdue": {
    label: "Review overdue",
    hint: "The scheduled review date has passed without a review.",
    tone: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  stale: {
    label: "Stale",
    hint: "No review date set and no edits in 90+ days. Assumptions may have broken.",
    tone: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
  orphaned: {
    label: "Orphaned",
    hint: "No owner assigned. Nobody is accountable for this decision.",
    tone: "bg-slate-100 text-slate-700 border-slate-300",
    dot: "bg-slate-400",
  },
  "superseded-unreviewed": {
    label: "Superseded · no retro",
    hint: "Replaced by another decision, but no one captured why the original broke.",
    tone: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
  superseded: {
    label: "Superseded",
    hint: "Replaced by a newer decision. A retro has been recorded.",
    tone: "bg-slate-100 text-slate-500 border-slate-200",
    dot: "bg-slate-400",
  },
  archived: {
    label: "Archived",
    hint: "Intentionally archived and no longer active.",
    tone: "bg-slate-100 text-slate-500 border-slate-200",
    dot: "bg-slate-400",
  },
};

/** Worst-first display order - used by the health header bar and the grouped decision list. */
export const HEALTH_DISPLAY_ORDER: DecisionHealth[] = [
  "superseded-unreviewed",
  "review-overdue",
  "stale",
  "orphaned",
  "review-due-soon",
  "superseded",
  "archived",
  "healthy",
];
