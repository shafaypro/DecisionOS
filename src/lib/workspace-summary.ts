/**
 * Workspace aggregator - one pass over every decision in a workspace, producing
 * the health distribution (per-state counts, healthy %, decision debt, top-N
 * attention lists) and the memory-completeness sums shown on /decisions.
 *
 * The dashboard's old comment predicted this extraction ("if a second consumer
 * appears we extract the aggregator"): /decisions is now that consumer. Health
 * itself stays in decision-health.ts - this only aggregates it.
 */

import {
  computeDecisionHealth,
  type DecisionHealth,
} from "@/lib/decision-health";

const ATTENTION_LIMIT = 5;

export interface WorkspaceRow {
  id: string;
  title: string;
  status: string;
  ownerUserId: string | null;
  reviewDate: Date | null;
  reviewedAt: Date | null;
  updatedAt: Date;
  rationale: string | null;
  problemStatement: string | null;
  chosenOption: string | null;
  reviewCount: number;
  owner: { name: string } | null;
}

export interface AttentionItem {
  id: string;
  title: string;
  updatedAt: Date;
  owner: { name: string } | null;
}

export interface WorkspaceSummary {
  total: number;
  counts: Record<DecisionHealth, number>;
  inactive: number;
  activeTotal: number;
  healthyShare: number;
  decisionDebt: number;
  totalAttention: number;
  attention: {
    supersededUnreviewed: AttentionItem[];
    reviewOverdue: AttentionItem[];
    stale: AttentionItem[];
    orphaned: AttentionItem[];
  };
  memory: {
    withRationale: number;
    withProblem: number;
    withChosenOption: number;
    withOwner: number;
    withReviewDate: number;
    overdueReviews: number;
    score: number;
  };
}

export function summarizeWorkspace(
  rows: WorkspaceRow[],
  now: Date = new Date(),
): WorkspaceSummary {
  const counts: Record<DecisionHealth, number> = {
    healthy: 0,
    "review-due-soon": 0,
    "review-overdue": 0,
    stale: 0,
    orphaned: 0,
    "superseded-unreviewed": 0,
    superseded: 0,
    archived: 0,
  };

  const tagged = rows.map((d) => ({
    row: d,
    health: computeDecisionHealth(
      {
        status: d.status,
        ownerUserId: d.ownerUserId,
        reviewDate: d.reviewDate,
        reviewedAt: d.reviewedAt,
        updatedAt: d.updatedAt,
        reviewCount: d.reviewCount,
      },
      now,
    ),
  }));

  const memory = {
    withRationale: 0,
    withProblem: 0,
    withChosenOption: 0,
    withOwner: 0,
    withReviewDate: 0,
    overdueReviews: 0,
    score: 0,
  };

  for (const { row, health } of tagged) {
    counts[health] += 1;
    if (row.rationale != null) memory.withRationale += 1;
    if (row.problemStatement != null) memory.withProblem += 1;
    if (row.chosenOption != null) memory.withChosenOption += 1;
    if (row.ownerUserId != null) memory.withOwner += 1;
    if (row.reviewDate != null) memory.withReviewDate += 1;
  }

  const toItem = (d: WorkspaceRow): AttentionItem => ({
    id: d.id,
    title: d.title,
    updatedAt: d.updatedAt,
    owner: d.owner,
  });
  const pick = (h: DecisionHealth) =>
    tagged
      .filter((t) => t.health === h)
      .slice(0, ATTENTION_LIMIT)
      .map((t) => toItem(t.row));

  const total = rows.length;
  const inactive = counts.archived + counts.superseded;
  const activeTotal = total - inactive;
  const healthyShare =
    activeTotal > 0 ? Math.round((counts.healthy / activeTotal) * 100) : 100;

  const totalAttention =
    counts["superseded-unreviewed"] +
    counts["review-overdue"] +
    counts.stale +
    counts.orphaned;

  memory.overdueReviews = counts["review-overdue"];
  memory.score =
    total > 0
      ? Math.round(
          ((memory.withRationale +
            memory.withProblem +
            memory.withChosenOption +
            memory.withOwner +
            memory.withReviewDate) /
            (total * 5)) *
            100,
        )
      : 0;

  return {
    total,
    counts,
    inactive,
    activeTotal,
    healthyShare,
    decisionDebt: totalAttention,
    totalAttention,
    attention: {
      supersededUnreviewed: pick("superseded-unreviewed"),
      reviewOverdue: pick("review-overdue"),
      stale: pick("stale"),
      orphaned: pick("orphaned"),
    },
    memory,
  };
}
