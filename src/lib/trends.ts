/**
 * Time-series analytics over the decision log.
 *
 * The existing analytics page answers "what does the workspace look like right
 * now". None of it answers "is this getting better or worse", which is the only
 * question a lead actually asks in a retro. This module derives the trend
 * series and the cycle-time statistics from plain rows.
 *
 * All functions are pure and take an explicit `now`, so the numbers on the page
 * are reproducible in a test rather than dependent on the clock.
 *
 * Sizing note: a workspace's decision set is small (thousands at most) and is
 * already fetched for the health roll-up, so these aggregate in memory rather
 * than adding another round of GROUP BY queries.
 */

export interface TrendRow {
  createdAt: Date;
  decisionDate?: Date | null;
  reviewDate?: Date | null;
  reviewedAt?: Date | null;
  status?: string | null;
  outcomeStatus?: string | null;
}

export interface MonthBucket {
  /** `YYYY-MM` - sortable and locale-independent. */
  key: string;
  /** Short display label, e.g. "Mar 25". */
  label: string;
  created: number;
  reviewed: number;
  reversed: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year.slice(2)}`;
}

/**
 * Bucket decisions into the last `months` calendar months (oldest first).
 * Empty months are included so the sparkline shows gaps honestly instead of
 * silently compressing a quiet quarter.
 */
export function monthlyBuckets(rows: TrendRow[], months = 12, now: Date = new Date()): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>();
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
    const key = monthKey(d);
    buckets.set(key, { key, label: monthLabel(key), created: 0, reviewed: 0, reversed: 0 });
  }

  for (const row of rows) {
    const created = buckets.get(monthKey(new Date(row.createdAt)));
    if (created) {
      created.created += 1;
      if (row.status === "reversed") created.reversed += 1;
    }
    if (row.reviewedAt) {
      const reviewed = buckets.get(monthKey(new Date(row.reviewedAt)));
      if (reviewed) reviewed.reviewed += 1;
    }
  }

  return Array.from(buckets.values());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Median of a numeric list. Returns null for an empty list (never NaN). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface CycleTimes {
  /** Median days between a decision being recorded and its decision date. */
  medianDaysToDecide: number | null;
  /** Median days between the scheduled review date and the review actually landing. */
  medianReviewLagDays: number | null;
  /** Share of decisions with a past review date that were in fact reviewed (0-100). */
  reviewCompliance: number;
  /** Reviews that are past due right now. */
  overdueNow: number;
}

export function cycleTimes(rows: TrendRow[], now: Date = new Date()): CycleTimes {
  const decideDays: number[] = [];
  const lagDays: number[] = [];
  let due = 0;
  let met = 0;
  let overdueNow = 0;

  for (const row of rows) {
    if (row.decisionDate) {
      const days = (new Date(row.decisionDate).getTime() - new Date(row.createdAt).getTime()) / DAY_MS;
      // Negative means the decision was back-dated on entry - a real and common
      // case (logging last week's call), and not a "time to decide" signal.
      if (days >= 0) decideDays.push(days);
    }

    if (row.reviewDate && new Date(row.reviewDate).getTime() <= now.getTime()) {
      due += 1;
      if (row.reviewedAt) {
        met += 1;
        lagDays.push(
          (new Date(row.reviewedAt).getTime() - new Date(row.reviewDate).getTime()) / DAY_MS,
        );
      } else {
        overdueNow += 1;
      }
    }
  }

  const rawDecide = median(decideDays);
  const rawLag = median(lagDays);

  return {
    medianDaysToDecide: rawDecide === null ? null : Math.round(rawDecide * 10) / 10,
    medianReviewLagDays: rawLag === null ? null : Math.round(rawLag * 10) / 10,
    reviewCompliance: due === 0 ? 100 : Math.round((met / due) * 100),
    overdueNow,
  };
}

export interface Momentum {
  /** Decisions created in the trailing window. */
  current: number;
  /** Decisions created in the window before that. */
  previous: number;
  /** Percent change, or null when there's no prior baseline to compare to. */
  changePct: number | null;
  direction: "up" | "down" | "flat";
}

/** Compare the trailing `days` window against the one immediately before it. */
export function momentum(rows: TrendRow[], days = 30, now: Date = new Date()): Momentum {
  const end = now.getTime();
  const midpoint = end - days * DAY_MS;
  const start = end - 2 * days * DAY_MS;

  let current = 0;
  let previous = 0;
  for (const row of rows) {
    const t = new Date(row.createdAt).getTime();
    if (t > midpoint && t <= end) current += 1;
    else if (t > start && t <= midpoint) previous += 1;
  }

  const changePct = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  const direction: Momentum["direction"] =
    current === previous ? "flat" : current > previous ? "up" : "down";

  return { current, previous, changePct, direction };
}

export interface OutcomeMix {
  successful: number;
  mixed: number;
  unsuccessful: number;
  unknown: number;
  /** Share of *known* outcomes that were successful (0-100); null when none known. */
  successRate: number | null;
}

export function outcomeMix(rows: TrendRow[]): OutcomeMix {
  const mix: OutcomeMix = { successful: 0, mixed: 0, unsuccessful: 0, unknown: 0, successRate: null };
  for (const row of rows) {
    switch (row.outcomeStatus) {
      case "successful": mix.successful += 1; break;
      case "mixed": mix.mixed += 1; break;
      case "unsuccessful": mix.unsuccessful += 1; break;
      default: mix.unknown += 1;
    }
  }
  const known = mix.successful + mix.mixed + mix.unsuccessful;
  mix.successRate = known === 0 ? null : Math.round((mix.successful / known) * 100);
  return mix;
}

export interface WorkspaceTrends {
  months: MonthBucket[];
  cycle: CycleTimes;
  momentum: Momentum;
  outcomes: OutcomeMix;
}

/** One-call roll-up for the analytics page and the trends API. */
export function computeTrends(
  rows: TrendRow[],
  { months = 12, windowDays = 30, now = new Date() } = {},
): WorkspaceTrends {
  return {
    months: monthlyBuckets(rows, months, now),
    cycle: cycleTimes(rows, now),
    momentum: momentum(rows, windowDays, now),
    outcomes: outcomeMix(rows),
  };
}

/**
 * Build an SVG polyline `points` string for a sparkline.
 *
 * Kept here (rather than in the component) because the scaling edge cases -
 * a single point, an all-zero series - are exactly what a chart gets wrong,
 * and here they're testable.
 */
export function sparklinePoints(
  values: number[],
  width = 120,
  height = 28,
  pad = 2,
): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const step = values.length === 1 ? 0 : usableW / (values.length - 1);

  return values
    .map((v, i) => {
      const x = pad + (values.length === 1 ? usableW / 2 : i * step);
      const y = pad + usableH - ((v - min) / span) * usableH;
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");
}
