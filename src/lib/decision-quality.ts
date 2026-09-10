/**
 * Decision quality score - "is this record actually useful in six months?"
 *
 * Health (decision-health.ts) answers *is this decision being maintained*.
 * Quality answers a different, complementary question: *was it written down
 * well enough to be re-read by someone who wasn't in the room*. A decision with
 * a title and nothing else is technically healthy and completely worthless as a
 * record.
 *
 * The score is a weighted completeness measure over the fields that carry
 * institutional memory, plus depth checks so a one-word "because" doesn't score
 * the same as a real rationale. It is computed, never stored - so it can be
 * tuned without a migration, and it can never drift from the underlying record.
 *
 * Weights are exported and deliberately opinionated:
 *   - rationale and alternatives are what people come back for, so they carry
 *     the most weight. "Why not the other thing?" is the single most expensive
 *     question to re-derive later.
 *   - owner and review date carry accountability weight.
 *   - summary / problem / chosen option are the basic shape of a record.
 *   - assumptions and risks are the fields that tell you *what to re-check* when
 *     the world changes.
 */

/** Minimum characters for a field to count as substantive rather than a stub. */
export const DEPTH_THRESHOLD = 40;

export interface DecisionQualityInput {
  summary?: string | null;
  problemStatement?: string | null;
  chosenOption?: string | null;
  rationale?: string | null;
  alternativesConsidered?: string | null;
  assumptions?: string | null;
  risks?: string | null;
  ownerUserId?: string | null;
  decisionDate?: Date | null;
  reviewDate?: Date | null;
  /** Optional signals that a record is *maintained*, not just filled in. */
  linkCount?: number;
  tagCount?: number;
}

export interface QualityCriterion {
  key: string;
  label: string;
  /** Points this criterion contributes when fully satisfied. */
  weight: number;
  /** Points actually earned (a stub earns half). */
  earned: number;
  met: boolean;
  /** Actionable text shown when the criterion is unmet. */
  hint: string;
}

export interface DecisionQuality {
  /** 0-100, rounded. */
  score: number;
  grade: "excellent" | "good" | "thin" | "poor";
  criteria: QualityCriterion[];
  /** Unmet criteria, worst (highest weight) first - drives the "improve this" list. */
  gaps: QualityCriterion[];
}

interface Rule {
  key: string;
  label: string;
  weight: number;
  hint: string;
  /** Text field checked for depth, or a boolean presence check. */
  value: (d: DecisionQualityInput) => string | boolean | null | undefined;
}

const RULES: Rule[] = [
  {
    key: "rationale",
    label: "Rationale",
    weight: 20,
    hint: "Explain why this option won. This is what people come back to read.",
    value: (d) => d.rationale,
  },
  {
    key: "alternatives",
    label: "Alternatives considered",
    weight: 18,
    hint: "List what you ruled out and why - it stops the team re-litigating it.",
    value: (d) => d.alternativesConsidered,
  },
  {
    key: "problem",
    label: "Problem statement",
    weight: 12,
    hint: "State the problem this decision solves, not just the solution.",
    value: (d) => d.problemStatement,
  },
  {
    key: "chosenOption",
    label: "Solution",
    weight: 10,
    hint: "Record what was actually chosen, in one clear paragraph.",
    value: (d) => d.chosenOption,
  },
  {
    key: "assumptions",
    label: "Assumptions",
    weight: 10,
    hint: "Name the assumptions - these are what quietly break later.",
    value: (d) => d.assumptions,
  },
  {
    key: "risks",
    label: "Risks",
    weight: 8,
    hint: "Capture the known risks so a reviewer knows what to check.",
    value: (d) => d.risks,
  },
  {
    key: "owner",
    label: "Owner",
    weight: 8,
    hint: "Assign an owner - unowned decisions are the ones that rot.",
    value: (d) => Boolean(d.ownerUserId),
  },
  {
    key: "reviewDate",
    label: "Review date",
    weight: 6,
    hint: "Schedule a review so the outcome actually gets checked.",
    value: (d) => Boolean(d.reviewDate),
  },
  {
    key: "summary",
    label: "Summary",
    weight: 4,
    hint: "Add a one-line summary for list views and search results.",
    value: (d) => d.summary,
  },
  {
    key: "links",
    label: "Supporting links",
    weight: 2,
    hint: "Attach the RFC, PR, or doc this decision came out of.",
    value: (d) => (d.linkCount ?? 0) > 0,
  },
  {
    key: "tags",
    label: "Tags",
    weight: 2,
    hint: "Tag the decision so it surfaces in the right slices later.",
    value: (d) => (d.tagCount ?? 0) > 0,
  },
];

/** Total weight - kept as a constant so a rule change can't silently rescale. */
export const MAX_QUALITY_POINTS = RULES.reduce((sum, r) => sum + r.weight, 0);

export function scoreDecisionQuality(d: DecisionQualityInput): DecisionQuality {
  const criteria: QualityCriterion[] = RULES.map((rule) => {
    const raw = rule.value(d);
    let earned = 0;
    let met = false;

    if (typeof raw === "string") {
      const len = raw.trim().length;
      if (len >= DEPTH_THRESHOLD) {
        earned = rule.weight;
        met = true;
      } else if (len > 0) {
        // Present but thin: half credit, and still listed as a gap so the hint
        // shows up ("go deeper here").
        earned = rule.weight / 2;
      }
    } else if (raw) {
      earned = rule.weight;
      met = true;
    }

    return { key: rule.key, label: rule.label, weight: rule.weight, earned, met, hint: rule.hint };
  });

  const points = criteria.reduce((sum, c) => sum + c.earned, 0);
  const score = Math.round((points / MAX_QUALITY_POINTS) * 100);

  return {
    score,
    grade: qualityGrade(score),
    criteria,
    gaps: criteria.filter((c) => !c.met).sort((a, b) => b.weight - a.weight),
  };
}

export function qualityGrade(score: number): DecisionQuality["grade"] {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 40) return "thin";
  return "poor";
}

export const QUALITY_META: Record<
  DecisionQuality["grade"],
  { label: string; hint: string; tone: string; bar: string }
> = {
  excellent: {
    label: "Excellent record",
    hint: "Rationale, alternatives, and accountability are all captured.",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bar: "bg-emerald-500",
  },
  good: {
    label: "Good record",
    hint: "Solid, with a few fields left to fill in.",
    tone: "bg-blue-50 text-blue-700 border-blue-200",
    bar: "bg-blue-500",
  },
  thin: {
    label: "Thin record",
    hint: "Readable today, hard to reconstruct in six months.",
    tone: "bg-amber-50 text-amber-800 border-amber-200",
    bar: "bg-amber-500",
  },
  poor: {
    label: "Poor record",
    hint: "Little more than a title - the reasoning is not captured.",
    tone: "bg-rose-50 text-rose-700 border-rose-200",
    bar: "bg-rose-500",
  },
};

/** Workspace roll-up: average score plus the most common gaps. */
export function summarizeQuality(
  rows: DecisionQualityInput[],
): { average: number; distribution: Record<DecisionQuality["grade"], number>; topGaps: { key: string; label: string; count: number }[] } {
  const distribution: Record<DecisionQuality["grade"], number> = {
    excellent: 0,
    good: 0,
    thin: 0,
    poor: 0,
  };
  const gapCounts = new Map<string, { label: string; count: number }>();
  let total = 0;

  for (const row of rows) {
    const q = scoreDecisionQuality(row);
    total += q.score;
    distribution[q.grade] += 1;
    for (const gap of q.gaps) {
      const entry = gapCounts.get(gap.key) ?? { label: gap.label, count: 0 };
      entry.count += 1;
      gapCounts.set(gap.key, entry);
    }
  }

  return {
    average: rows.length > 0 ? Math.round(total / rows.length) : 0,
    distribution,
    topGaps: Array.from(gapCounts.entries())
      .map(([key, v]) => ({ key, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
