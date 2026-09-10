import {
  DEPTH_THRESHOLD,
  MAX_QUALITY_POINTS,
  QUALITY_META,
  qualityGrade,
  scoreDecisionQuality,
  summarizeQuality,
  type DecisionQualityInput,
} from "../../src/lib/decision-quality";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const deep = (label: string) => `${label} `.repeat(20).trim();

const COMPLETE: DecisionQualityInput = {
  summary: deep("summary"),
  problemStatement: deep("problem"),
  chosenOption: deep("chosen"),
  rationale: deep("rationale"),
  alternativesConsidered: deep("alternatives"),
  assumptions: deep("assumptions"),
  risks: deep("risks"),
  ownerUserId: "u1",
  reviewDate: new Date("2026-01-01"),
  linkCount: 2,
  tagCount: 1,
};

export const decisionQualityTests = {
  "a fully filled record scores 100": () => {
    assert(scoreDecisionQuality(COMPLETE).score === 100, "complete record is 100");
  },

  "a title-only record scores 0 and every criterion is a gap": () => {
    const q = scoreDecisionQuality({});
    assert(q.score === 0, "nothing captured");
    assert(q.grade === "poor", "graded poor");
    assert(q.gaps.length === q.criteria.length, "all criteria unmet");
  },

  "a stub field earns half credit and still shows up as a gap": () => {
    const q = scoreDecisionQuality({ rationale: "because" });
    const rationale = q.criteria.find((c) => c.key === "rationale")!;
    assert(rationale.earned === rationale.weight / 2, "half credit for a stub");
    assert(!rationale.met, "still counted as a gap so the hint shows");
    assert(q.gaps.some((g) => g.key === "rationale"), "listed in gaps");
  },

  "the depth threshold is what separates a stub from a real answer": () => {
    const justUnder = "x".repeat(DEPTH_THRESHOLD - 1);
    const justOver = "x".repeat(DEPTH_THRESHOLD);
    assert(!scoreDecisionQuality({ rationale: justUnder }).criteria.find((c) => c.key === "rationale")!.met, "under threshold is a stub");
    assert(scoreDecisionQuality({ rationale: justOver }).criteria.find((c) => c.key === "rationale")!.met, "at threshold counts");
  },

  "whitespace doesn't buy depth": () => {
    const q = scoreDecisionQuality({ rationale: " ".repeat(200) });
    assert(q.score === 0, "blank text earns nothing");
  },

  "rationale and alternatives carry the most weight": () => {
    const withRationale = scoreDecisionQuality({ rationale: deep("r") }).score;
    const withSummary = scoreDecisionQuality({ summary: deep("s") }).score;
    assert(withRationale > withSummary, "rationale outweighs summary");
    const rationaleWeight = scoreDecisionQuality({}).criteria.find((c) => c.key === "rationale")!.weight;
    const altWeight = scoreDecisionQuality({}).criteria.find((c) => c.key === "alternatives")!.weight;
    assert(rationaleWeight >= altWeight, "rationale is the heaviest criterion");
  },

  "gaps are ordered worst-first so the top hint is the highest-value fix": () => {
    const q = scoreDecisionQuality({ summary: deep("s") });
    assert(q.gaps[0].key === "rationale", "heaviest gap first");
    for (let i = 1; i < q.gaps.length; i++) {
      assert(q.gaps[i - 1].weight >= q.gaps[i].weight, "descending weight");
    }
  },

  "boolean criteria (owner, review date, links, tags) are presence checks": () => {
    const q = scoreDecisionQuality({ ownerUserId: "u1", reviewDate: new Date(), linkCount: 1, tagCount: 3 });
    for (const key of ["owner", "reviewDate", "links", "tags"]) {
      assert(q.criteria.find((c) => c.key === key)!.met, `${key} met`);
    }
    const none = scoreDecisionQuality({ linkCount: 0, tagCount: 0 });
    assert(!none.criteria.find((c) => c.key === "links")!.met, "zero links is unmet");
  },

  "weights sum to the exported maximum": () => {
    const sum = scoreDecisionQuality({}).criteria.reduce((t, c) => t + c.weight, 0);
    assert(sum === MAX_QUALITY_POINTS, "no rule drifted out of the total");
  },

  "grades map to the documented bands and every grade has display metadata": () => {
    assert(qualityGrade(100) === "excellent", "100 excellent");
    assert(qualityGrade(85) === "excellent", "85 is the boundary");
    assert(qualityGrade(84) === "good", "just below");
    assert(qualityGrade(65) === "good", "65 good");
    assert(qualityGrade(64) === "thin", "just below");
    assert(qualityGrade(40) === "thin", "40 thin");
    assert(qualityGrade(39) === "poor", "just below");
    for (const grade of ["excellent", "good", "thin", "poor"] as const) {
      assert(QUALITY_META[grade].label.length > 0, `${grade} has a label`);
    }
  },

  "summarizeQuality averages, distributes, and ranks the common gaps": () => {
    const s = summarizeQuality([COMPLETE, {}, { rationale: deep("r"), ownerUserId: "u1" }]);
    assert(s.distribution.excellent === 1, "one excellent");
    assert(s.distribution.poor >= 1, "one poor");
    assert(s.average > 0 && s.average < 100, "average between the extremes");
    assert(s.topGaps.length > 0 && s.topGaps.length <= 5, "gaps ranked and capped");
    assert(s.topGaps[0].count >= s.topGaps[s.topGaps.length - 1].count, "descending");
  },

  "summarizeQuality on an empty workspace is 0, not NaN": () => {
    const s = summarizeQuality([]);
    assert(s.average === 0, "no divide by zero");
    assert(s.topGaps.length === 0, "no gaps");
  },
};
