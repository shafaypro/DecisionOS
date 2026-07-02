import { summarizeWorkspace, type WorkspaceRow } from "../../src/lib/workspace-summary";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const NOW = new Date("2026-06-18T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

// Minimal row factory - only the fields summarizeWorkspace reads.
function row(over: Partial<WorkspaceRow>): WorkspaceRow {
  return {
    id: "d",
    title: "t",
    status: "approved",
    ownerUserId: "u1",
    reviewDate: days(30),
    reviewedAt: null,
    updatedAt: days(-1),
    rationale: "why",
    problemStatement: "p",
    chosenOption: "c",
    reviewCount: 1,
    owner: { name: "Owner" },
    ...over,
  };
}

export const workspaceSummaryTests = {
  "empty workspace: healthyShare 100, debt 0, score 0": () => {
    const s = summarizeWorkspace([], NOW);
    assert(s.total === 0, `total ${s.total}`);
    assert(s.healthyShare === 100, `healthyShare ${s.healthyShare}`);
    assert(s.decisionDebt === 0, `debt ${s.decisionDebt}`);
    assert(s.memory.score === 0, `score ${s.memory.score}`);
  },

  "counts each health state once": () => {
    const s = summarizeWorkspace(
      [
        row({ id: "a" }), // healthy
        row({ id: "b", ownerUserId: null }), // orphaned
        row({ id: "c", reviewDate: days(-3), reviewedAt: null }), // review-overdue
        row({ id: "d", status: "superseded", reviewCount: 0, reviewedAt: null }), // superseded-unreviewed
      ],
      NOW,
    );
    assert(s.counts.healthy === 1, `healthy ${s.counts.healthy}`);
    assert(s.counts.orphaned === 1, `orphaned ${s.counts.orphaned}`);
    assert(s.counts["review-overdue"] === 1, `overdue ${s.counts["review-overdue"]}`);
    assert(s.counts["superseded-unreviewed"] === 1, `sup ${s.counts["superseded-unreviewed"]}`);
    assert(s.total === 4, `total ${s.total}`);
  },

  "healthyShare excludes archived + superseded from denominator": () => {
    // 1 healthy + 1 archived + 1 superseded(reviewed). active = 1, healthy = 1 -> 100%.
    const s = summarizeWorkspace(
      [
        row({ id: "a" }),
        row({ id: "b", status: "archived" }),
        row({ id: "c", status: "superseded", reviewCount: 1 }),
      ],
      NOW,
    );
    assert(s.inactive === 2, `inactive ${s.inactive}`);
    assert(s.activeTotal === 1, `activeTotal ${s.activeTotal}`);
    assert(s.healthyShare === 100, `healthyShare ${s.healthyShare}`);
  },

  "decisionDebt = sum of the 4 attention states; overdueReviews mirrors review-overdue": () => {
    const s = summarizeWorkspace(
      [
        row({ id: "a", ownerUserId: null }), // orphaned
        row({ id: "b", reviewDate: days(-3) }), // review-overdue
        row({ id: "c", status: "superseded", reviewCount: 0, reviewedAt: null }), // superseded-unreviewed
        row({ id: "d", reviewDate: null, updatedAt: days(-200) }), // stale
        row({ id: "e" }), // healthy - not debt
      ],
      NOW,
    );
    assert(s.decisionDebt === 4, `debt ${s.decisionDebt}`);
    assert(s.totalAttention === 4, `totalAttention ${s.totalAttention}`);
    assert(s.memory.overdueReviews === s.counts["review-overdue"], "overdueReviews mirror");
  },

  "attention lists cap at 5 and carry id/title/owner": () => {
    const overdue = Array.from({ length: 7 }, (_, i) =>
      row({ id: `o${i}`, reviewDate: days(-3) }),
    );
    const s = summarizeWorkspace(overdue, NOW);
    assert(s.attention.reviewOverdue.length === 5, `len ${s.attention.reviewOverdue.length}`);
    assert(s.counts["review-overdue"] === 7, `count ${s.counts["review-overdue"]}`);
    assert(s.attention.reviewOverdue[0].title === "t", "title carried");
  },

  "memory score = filled fields / (total*5), rounded": () => {
    // 2 rows, all 5 fields filled on both -> 10/10 = 100.
    const full = summarizeWorkspace([row({ id: "a" }), row({ id: "b" })], NOW);
    assert(full.memory.score === 100, `full ${full.memory.score}`);
    // 1 row, only rationale filled -> 1/5 = 20.
    const partial = summarizeWorkspace(
      [
        row({
          id: "a",
          problemStatement: null,
          chosenOption: null,
          ownerUserId: null,
          reviewDate: null,
        }),
      ],
      NOW,
    );
    assert(partial.memory.score === 20, `partial ${partial.memory.score}`);
    assert(partial.memory.withRationale === 1, `wR ${partial.memory.withRationale}`);
    assert(partial.memory.withOwner === 0, `wO ${partial.memory.withOwner}`);
  },
};
