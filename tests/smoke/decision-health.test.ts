import { computeDecisionHealth } from "../../src/lib/decision-health";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const NOW = new Date("2026-04-22T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

export const decisionHealthTests = {
  "healthy: owned, reviewed, active": () => {
    const h = computeDecisionHealth(
      {
        status: "approved",
        ownerUserId: "u1",
        reviewDate: days(30),
        reviewedAt: null,
        updatedAt: days(-5),
      },
      NOW,
    );
    assert(h === "healthy", `expected healthy, got ${h}`);
  },

  "review-due-soon: reviewDate within 7d": () => {
    const h = computeDecisionHealth(
      {
        status: "approved",
        ownerUserId: "u1",
        reviewDate: days(3),
        reviewedAt: null,
        updatedAt: NOW,
      },
      NOW,
    );
    assert(h === "review-due-soon", `expected review-due-soon, got ${h}`);
  },

  "review-overdue: reviewDate in past, no reviewedAt": () => {
    const h = computeDecisionHealth(
      {
        status: "approved",
        ownerUserId: "u1",
        reviewDate: days(-10),
        reviewedAt: null,
        updatedAt: days(-10),
      },
      NOW,
    );
    assert(h === "review-overdue", `expected review-overdue, got ${h}`);
  },

  "stale: no reviewDate, no edits in 90+ days": () => {
    const h = computeDecisionHealth(
      {
        status: "approved",
        ownerUserId: "u1",
        reviewDate: null,
        reviewedAt: null,
        updatedAt: days(-120),
      },
      NOW,
    );
    assert(h === "stale", `expected stale, got ${h}`);
  },

  "orphaned: active with no owner": () => {
    const h = computeDecisionHealth(
      {
        status: "approved",
        ownerUserId: null,
        reviewDate: days(30),
        reviewedAt: null,
        updatedAt: NOW,
      },
      NOW,
    );
    assert(h === "orphaned", `expected orphaned, got ${h}`);
  },

  "superseded-unreviewed: replaced but no retro": () => {
    const h = computeDecisionHealth(
      {
        status: "superseded",
        ownerUserId: "u1",
        reviewDate: null,
        reviewedAt: null,
        updatedAt: days(-5),
        reviewCount: 0,
      },
      NOW,
    );
    assert(h === "superseded-unreviewed", `expected superseded-unreviewed, got ${h}`);
  },

  "superseded with retro is plain superseded": () => {
    const h = computeDecisionHealth(
      {
        status: "superseded",
        ownerUserId: "u1",
        reviewDate: null,
        reviewedAt: days(-3),
        updatedAt: days(-5),
        reviewCount: 1,
      },
      NOW,
    );
    assert(h === "superseded", `expected superseded, got ${h}`);
  },

  "archived is neutral": () => {
    const h = computeDecisionHealth(
      {
        status: "archived",
        ownerUserId: null,
        reviewDate: null,
        reviewedAt: null,
        updatedAt: days(-500),
      },
      NOW,
    );
    assert(h === "archived", `expected archived, got ${h}`);
  },

  "superseded-unreviewed beats archived/overdue rules": () => {
    // Precedence check: even if review is overdue, superseded-unreviewed wins
    const h = computeDecisionHealth(
      {
        status: "superseded",
        ownerUserId: "u1",
        reviewDate: days(-50),
        reviewedAt: null,
        updatedAt: days(-60),
        reviewCount: 0,
      },
      NOW,
    );
    assert(h === "superseded-unreviewed", `expected superseded-unreviewed, got ${h}`);
  },
};
