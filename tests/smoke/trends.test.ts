import {
  computeTrends,
  cycleTimes,
  median,
  momentum,
  monthlyBuckets,
  outcomeMix,
  sparklinePoints,
  type TrendRow,
} from "../../src/lib/trends";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const NOW = new Date("2025-06-15T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

export const trendsTests = {
  "monthlyBuckets returns exactly N months, oldest first, ending this month": () => {
    const buckets = monthlyBuckets([], 6, NOW);
    assert(buckets.length === 6, "six buckets");
    assert(buckets[0].key === "2025-01", "oldest is January");
    assert(buckets[5].key === "2025-06", "newest is the current month");
    assert(buckets[5].label === "Jun 25", "label formatted");
  },

  "empty months are kept so a quiet quarter isn't silently compressed": () => {
    const rows: TrendRow[] = [{ createdAt: new Date("2025-06-02T00:00:00Z") }];
    const buckets = monthlyBuckets(rows, 3, NOW);
    assert(buckets.length === 3, "three buckets");
    assert(buckets[0].created === 0 && buckets[1].created === 0, "quiet months present with zero");
    assert(buckets[2].created === 1, "the active month counted");
  },

  "buckets count creations, reviews, and reversals independently": () => {
    const rows: TrendRow[] = [
      { createdAt: new Date("2025-05-01T00:00:00Z"), status: "reversed" },
      { createdAt: new Date("2025-05-02T00:00:00Z"), reviewedAt: new Date("2025-06-01T00:00:00Z") },
    ];
    const buckets = monthlyBuckets(rows, 3, NOW);
    const may = buckets.find((b) => b.key === "2025-05")!;
    const jun = buckets.find((b) => b.key === "2025-06")!;
    assert(may.created === 2 && may.reversed === 1, "May: two created, one reversed");
    assert(jun.reviewed === 1, "the review lands in the month it happened, not creation month");
  },

  "rows outside the window are ignored rather than bucketed into the edges": () => {
    const buckets = monthlyBuckets([{ createdAt: new Date("2020-01-01T00:00:00Z") }], 3, NOW);
    assert(buckets.every((b) => b.created === 0), "ancient row dropped");
  },

  "median handles even, odd, and empty lists": () => {
    assert(median([3, 1, 2]) === 2, "odd");
    assert(median([1, 2, 3, 4]) === 2.5, "even averages the middle pair");
    assert(median([]) === null, "empty is null, never NaN");
  },

  "cycleTimes measures time-to-decide and ignores back-dated entries": () => {
    const rows: TrendRow[] = [
      { createdAt: day(10), decisionDate: day(6) },   // 4 days
      { createdAt: day(10), decisionDate: day(8) },   // 2 days
      { createdAt: day(10), decisionDate: day(40) },  // back-dated: excluded
    ];
    assert(cycleTimes(rows, NOW).medianDaysToDecide === 3, "median of 2 and 4");
  },

  "review compliance counts only decisions whose review date has passed": () => {
    const rows: TrendRow[] = [
      { createdAt: day(90), reviewDate: day(10), reviewedAt: day(8) },  // due, met
      { createdAt: day(90), reviewDate: day(5) },                        // due, missed
      { createdAt: day(90), reviewDate: new Date(NOW.getTime() + 86400000) }, // not due yet
    ];
    const c = cycleTimes(rows, NOW);
    assert(c.reviewCompliance === 50, "one of two due reviews met");
    assert(c.overdueNow === 1, "one overdue right now");
    assert(c.medianReviewLagDays === 2, "the met review landed two days after its due date");
  },

  "compliance is 100 when nothing is due yet - not 0": () => {
    const c = cycleTimes([{ createdAt: day(3) }], NOW);
    assert(c.reviewCompliance === 100, "no due reviews means nothing missed");
    assert(c.medianDaysToDecide === null, "no data is null");
  },

  "momentum compares the trailing window with the one before it": () => {
    const rows: TrendRow[] = [
      { createdAt: day(5) }, { createdAt: day(10) }, { createdAt: day(20) },
      { createdAt: day(40) },
    ];
    const m = momentum(rows, 30, NOW);
    assert(m.current === 3, "three in the last 30 days");
    assert(m.previous === 1, "one in the prior window");
    assert(m.changePct === 200, "tripled");
    assert(m.direction === "up", "trending up");
  },

  "momentum reports null change when there is no baseline": () => {
    const m = momentum([{ createdAt: day(2) }], 30, NOW);
    assert(m.changePct === null, "no divide by zero");
    assert(m.direction === "up", "still directionally up");
  },

  "momentum is flat when both windows match": () => {
    const m = momentum([{ createdAt: day(5) }, { createdAt: day(40) }], 30, NOW);
    assert(m.direction === "flat" && m.changePct === 0, "flat");
  },

  "outcomeMix ignores unknown outcomes when computing the success rate": () => {
    const mix = outcomeMix([
      { createdAt: NOW, outcomeStatus: "successful" },
      { createdAt: NOW, outcomeStatus: "unsuccessful" },
      { createdAt: NOW, outcomeStatus: "unknown" },
      { createdAt: NOW },
    ]);
    assert(mix.unknown === 2, "unset counts as unknown");
    assert(mix.successRate === 50, "rate over known outcomes only");
  },

  "outcomeMix returns a null success rate when nothing is known": () => {
    assert(outcomeMix([{ createdAt: NOW }]).successRate === null, "null, not 0");
  },

  "computeTrends assembles all four views in one pass": () => {
    const t = computeTrends([{ createdAt: day(3), outcomeStatus: "successful" }], { months: 3, now: NOW });
    assert(t.months.length === 3, "months");
    assert(t.momentum.current === 1, "momentum");
    assert(t.outcomes.successful === 1, "outcomes");
    assert(t.cycle.reviewCompliance === 100, "cycle");
  },

  "sparklinePoints scales into the box and survives degenerate series": () => {
    const points = sparklinePoints([0, 5, 10], 100, 20, 2);
    const coords = points.split(" ").map((p) => p.split(",").map(Number));
    assert(coords.length === 3, "one point per value");
    assert(coords[0][1] > coords[2][1], "higher value plots higher on screen (smaller y)");
    for (const [x, y] of coords) {
      assert(x >= 0 && x <= 100 && y >= 0 && y <= 20, "inside the viewbox");
    }
    assert(sparklinePoints([]) === "", "empty series renders nothing");
    assert(sparklinePoints([4]).split(" ").length === 1, "single point is centered, not NaN");
    assert(!sparklinePoints([0, 0, 0]).includes("NaN"), "flat series doesn't divide by zero");
  },
};
