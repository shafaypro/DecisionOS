# Merge Workspace Health into the Decisions page - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Collapse `/dashboard` ("Workspace health") and `/decisions` into a single `/decisions` page that shows workspace health on top and the decision list below; drop the Health nav item; redirect `/dashboard`.

**Architecture:** Extract the dashboard's inline aggregation (per-state health counts, healthy %, decision debt, top-N attention lists) **and** the decisions page's memory completeness sums into ONE pure function `summarizeWorkspace(rows, now)` in `src/lib/workspace-summary.ts`, TDD'd via a smoke suite. The `/decisions` page fetches one extra **unfiltered** lightweight `findMany` for workspace-wide aggregates (replacing 8 existing `count()` queries), keeps its existing **filtered** `findMany` for the list verbatim (zero change to list/filter behavior), and renders a new server component `WorkspaceHealth` (the band + attention quadrants moved from the dashboard) above the list. `/dashboard` becomes a one-line `redirect("/decisions")`; internal links repoint to `/decisions`.

**Tech Stack:** Next.js 16 (RSC), Prisma v7 (`src/generated/prisma/`), Tailwind, zero-dep smoke tests (`tests/smoke/`).

**Reuse rules (CLAUDE.md):** Reuse `computeDecisionHealth` + `HEALTH_META` - do NOT fork them. Reuse `src/components/ui/` primitives. Move existing markup verbatim; do not restyle.

**Baseline before starting (capture, then diff against it):**
- `npm run test:smoke` → 38 passing.
- `npx tsc --noEmit` → clean.
- `npm run lint` → 4 PRE-EXISTING errors in `graph` / `app-shell`. NOT ours. Do not touch those files; do not add new errors.

---

## Decisions already settled (do not re-litigate)

- **Approach:** health summary moves onto `/decisions`; Health nav dropped; `/dashboard` redirects. (Options b/c rejected - `/decisions` is the canonical route the health legend already links into.)
- **Health vs memory:** health is the single headline (band + distribution + attention + decision debt). Memory metrics stay as a **secondary** strip but the competing `% memory` / `% retrieval ready` headline badges are **dropped**.
- **Page title:** stays "Decisions".
- **Aggregates ignore filters:** health band + memory strip reflect the **whole workspace** (same as today's dashboard); only the list respects search/filters.
- **Data:** keep the existing filtered `findMany` for the list as-is; add ONE unfiltered aggregate `findMany`; drop the 8 `count()` queries + derive `memberCount` from `members.length`.

---

## Task 1: Pure aggregator `summarizeWorkspace` (TDD)

**Files:**
- Create: `src/lib/workspace-summary.ts`
- Test: `tests/smoke/workspace-summary.test.ts`
- Modify: `tests/smoke/run.ts`

### Step 1: Write the failing test

Create `tests/smoke/workspace-summary.test.ts`:

```ts
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
```

Register it in `tests/smoke/run.ts`:

```ts
import { workspaceSummaryTests } from "./workspace-summary.test";
```

and add to the `SUITES` array:

```ts
  { name: "workspace summary (health + memory aggregate)", tests: workspaceSummaryTests },
```

### Step 2: Run test to verify it fails

Run: `npm run test:smoke`
Expected: FAIL - `Cannot find module '../../src/lib/workspace-summary'`.

### Step 3: Write minimal implementation

Create `src/lib/workspace-summary.ts`:

```ts
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
```

### Step 4: Run test to verify it passes

Run: `npm run test:smoke`
Expected: PASS - all `workspace summary` tests green, total now **44 passing** (38 + 6).

### Step 5: tsc + commit

Run: `npx tsc --noEmit` → clean.

```bash
git add src/lib/workspace-summary.ts tests/smoke/workspace-summary.test.ts tests/smoke/run.ts
git commit -m "feat: add summarizeWorkspace aggregator (health + memory)"
```

---

## Task 2: `WorkspaceHealth` server component

Move the dashboard's health band + attention quadrants markup verbatim into a reusable server component that consumes a `WorkspaceSummary`.

**Files:**
- Create: `src/components/decisions/workspace-health.tsx`

### Step 1: Create the component

Source the markup from `src/app/(app)/dashboard/page.tsx:200-395` (the headline/distribution block, the attention grid, the tip line, and the `AttentionList` helper). Adapt to read from a `summary: WorkspaceSummary` prop. Keep `HEALTH_DISPLAY_ORDER` and `HEALTH_BAR_COLOR` here (moved from the dashboard). Do NOT restyle - copy classNames as-is.

```tsx
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Ghost,
  Hourglass,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Text } from "@/components/ui/text";
import { Row } from "@/components/ui/row";
import { formatRelativeDate } from "@/lib/utils";
import { HEALTH_META, type DecisionHealth } from "@/lib/decision-health";
import type { AttentionItem, WorkspaceSummary } from "@/lib/workspace-summary";

const HEALTH_DISPLAY_ORDER: DecisionHealth[] = [
  "superseded-unreviewed",
  "review-overdue",
  "stale",
  "orphaned",
  "review-due-soon",
  "superseded",
  "archived",
  "healthy",
];

const HEALTH_BAR_COLOR: Record<DecisionHealth, string> = {
  healthy: "bg-emerald-500",
  "review-due-soon": "bg-blue-500",
  "review-overdue": "bg-amber-500",
  stale: "bg-rose-500",
  orphaned: "bg-slate-400",
  "superseded-unreviewed": "bg-rose-600",
  superseded: "bg-slate-300",
  archived: "bg-slate-200",
};

export function WorkspaceHealth({ summary }: { summary: WorkspaceSummary }) {
  const { counts, total, activeTotal, inactive, healthyShare, totalAttention, attention } = summary;

  return (
    <>
      {/* Headline score + distribution bar */}
      <div className="rounded-xs transition-all duration-200 p-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Text as="p">{healthyShare}%</Text>
          <Text as="p">
            of active decisions are healthy
            {activeTotal !== total && (
              <Text as="span"> ({inactive} archived/superseded excluded)</Text>
            )}
          </Text>
        </div>

        <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          {HEALTH_DISPLAY_ORDER.map((h) =>
            counts[h] > 0 ? (
              <div
                key={h}
                title={`${HEALTH_META[h].label}: ${counts[h]}`}
                className={HEALTH_BAR_COLOR[h]}
                style={{ width: `${(counts[h] / total) * 100}%` }}
              />
            ) : null,
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {HEALTH_DISPLAY_ORDER.filter((h) => counts[h] > 0).map((h) => (
            <Link
              key={h}
              href={`/decisions?health=${h}`}
              className="flex items-center gap-1.5 hover:text-text-primary"
              title={HEALTH_META[h].hint}
            >
              <div
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${HEALTH_BAR_COLOR[h]}`}
              />
              <Text as="span">{HEALTH_META[h].label}</Text>
              <Text as="span">{counts[h]}</Text>
            </Link>
          ))}
        </div>
      </div>

      {/* Attention quadrants */}
      {totalAttention === 0 ? (
        <div className="rounded-xs transition-all duration-200 border-emerald-200 bg-emerald-50/60 px-2 py-1.5">
          <Row
            wrap
            leading={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
            title={<Text>Nothing rotting today.</Text>}
            subtitle={
              <Text>
                No overdue reviews, stale entries, orphaned decisions, or
                superseded-without-retro records.
              </Text>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AttentionList
            icon={AlertTriangle}
            iconClass="text-rose-600"
            title="Superseded without a retro"
            blurb="Replaced - but no one captured why the original broke."
            href="/decisions?health=superseded-unreviewed"
            total={counts["superseded-unreviewed"]}
            items={attention.supersededUnreviewed}
          />
          <AttentionList
            icon={Hourglass}
            iconClass="text-amber-600"
            title="Review overdue"
            blurb="Scheduled review date has passed."
            href="/decisions?review=due"
            total={counts["review-overdue"]}
            items={attention.reviewOverdue}
          />
          <AttentionList
            icon={Clock}
            iconClass="text-rose-600"
            title="Stale"
            blurb="No review set, no edits in 90+ days."
            href="/decisions?health=stale"
            total={counts.stale}
            items={attention.stale}
          />
          <AttentionList
            icon={Ghost}
            iconClass="text-slate-500"
            title="Orphaned"
            blurb="Active but no owner - nobody is accountable."
            href="/decisions?health=orphaned"
            total={counts.orphaned}
            items={attention.orphaned}
          />
        </div>
      )}

      <div className="rounded-xs transition-all duration-200 px-2 py-1.5">
        <Row
          wrap
          leading={<Users className="h-4 w-4 text-slate-400" />}
          title="Tip: assign owners for orphaned decisions and run a 5-minute retro on each superseded-without-retro entry. Future you will thank you."
        />
      </div>
    </>
  );
}

function AttentionList({
  icon: Icon,
  iconClass,
  title,
  blurb,
  href,
  total,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  blurb: string;
  href: string;
  total: number;
  items: AttentionItem[];
}) {
  if (total === 0) {
    return (
      <div className="rounded-xs transition-all duration-200 flex flex-col gap-1 border-emerald-100 bg-emerald-50/40 p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-emerald-600" />
          <Text as="p">{title}</Text>
          <Text as="span">0</Text>
        </div>
        <Text as="p">All clear.</Text>
      </div>
    );
  }

  return (
    <div className="rounded-xs transition-all duration-200 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <Text as="p">{title}</Text>
        <Text as="span">{total}</Text>
      </div>
      <Text as="p">{blurb}</Text>
      <ul className="space-y-1.5">
        {items.map((d) => (
          <Text as="li" key={d.id}>
            <Link
              href={`/decisions/${d.id}`}
              className="group flex items-center gap-2 rounded-xs px-2 py-1.5 hover:bg-slate-50"
            >
              <Text as="span">{d.title}</Text>
              <Text as="span">{d.owner?.name ?? "unassigned"}</Text>
              <Text as="span">{formatRelativeDate(d.updatedAt)}</Text>
            </Link>
          </Text>
        ))}
      </ul>
      {total > items.length && (
        <Link
          href={href}
          className="mt-2 inline-flex items-center gap-1 hover:opacity-80"
        >
          <Text as="span">See all {total}</Text>
          <ArrowRight className="h-3 w-3 text-text-brand" />
        </Link>
      )}
    </div>
  );
}
```

### Step 2: tsc

Run: `npx tsc --noEmit` → clean. (No test - pure presentational; verified visually in Task 5.)

### Step 3: Commit

```bash
git add src/components/decisions/workspace-health.tsx
git commit -m "feat: add WorkspaceHealth component (moved from dashboard)"
```

---

## Task 3: Wire the health band + memory into `/decisions`

**Files:**
- Modify: `src/app/(app)/decisions/page.tsx`

### Step 1: Swap the query block

Replace the `Promise.all` data block (`page.tsx:159-224`, the `decisionsRaw…slackLink` destructure, the `memoryScore` calc) with: keep the existing **filtered** `decisionsRaw` findMany verbatim; add ONE unfiltered aggregate findMany; drop the 8 `count()` queries; compute the summary.

```ts
const [decisionsRaw, aggRows, slackLink] = await Promise.all([
  prisma.decision.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { notes: true, reviews: true } },
    },
  }),
  prisma.decision.findMany({
    where: { workspaceId },
    select: {
      id: true,
      title: true,
      status: true,
      ownerUserId: true,
      reviewDate: true,
      reviewedAt: true,
      updatedAt: true,
      rationale: true,
      problemStatement: true,
      chosenOption: true,
      owner: { select: { name: true } },
      _count: { select: { reviews: true } },
    },
  }),
  prisma.slackWorkspaceLink.findUnique({ where: { decisionWorkspaceId: workspaceId } }),
]);

const summary = summarizeWorkspace(
  aggRows.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    ownerUserId: d.ownerUserId,
    reviewDate: d.reviewDate,
    reviewedAt: d.reviewedAt,
    updatedAt: d.updatedAt,
    rationale: d.rationale,
    problemStatement: d.problemStatement,
    chosenOption: d.chosenOption,
    reviewCount: d._count.reviews,
    owner: d.owner,
  })),
  now,
);

const totalCount = summary.total;
const overdueReviews = summary.memory.overdueReviews;
const memoryScore = summary.memory.score;
const { withRationale, withOwner, withReviewDate } = summary.memory;
const memberCount = members.length;
```

Update imports at top:

```ts
import { summarizeWorkspace } from "@/lib/workspace-summary";
import { WorkspaceHealth } from "@/components/decisions/workspace-health";
```

Then **delete** the now-unused `memoryScoreTone` import only if nothing else uses it (it's used by the memory card badge we're dropping - confirm via grep before removing). Keep `withProblem`/`withChosenOption` out of destructure (unused by UI; they feed `summary.memory.score` internally).

> Note: the `health=` post-fetch filter block (`page.tsx:200-215`) still applies to `decisionsRaw` - keep it. It re-runs `computeDecisionHealth` per displayed row; that's fine and unchanged.

### Step 2: Drop the `% memory` header badge

Remove the `{totalCount > 0 && (<span … memory>…</span>)}` block in the `PageHeader` children (`page.tsx:321-337`). Keep the count line and the `isViewer` "Read-only" tag.

### Step 3: Insert the health band, reorder

Immediately after `</PageHeader>`, before the search/filters row, add:

```tsx
{totalCount > 0 && <WorkspaceHealth summary={summary} />}
```

Move the existing **memory metrics card** (`page.tsx:354-398`) to sit directly **after** the `<WorkspaceHealth>` block and **before** the search row - and inside it **delete the `% retrieval ready` `<Badge>`** (the header row of that card), keeping the 4 `MemoryMetric` cells. Result top-to-bottom: PageHeader → WorkspaceHealth → memory metrics strip → search+filters → Focus chips → health-filter banner → onboarding checklist → list.

### Step 4: Gate

Run: `npx tsc --noEmit` → clean (watch for unused-var/import errors - remove any symbol you orphaned).
Run: `npm run lint` → no NEW errors vs the 4 pre-existing.
Run: `npm run test:smoke` → 44 passing.

### Step 5: Commit

```bash
git add src/app/(app)/decisions/page.tsx
git commit -m "feat: render workspace health on /decisions; drop memory headline badges"
```

---

## Task 4: Redirect `/dashboard`, drop Health nav, repoint links

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx` (replace body with redirect)
- Delete: `src/app/(app)/dashboard/loading.tsx`
- Modify: `src/components/layout/sidebar.tsx:22-30`
- Modify: `src/proxy.ts:31`, `src/app/(app)/not-found.tsx:17`, `src/components/layout/breadcrumbs.tsx:62`, `src/components/ui/shortcuts-overlay.tsx:67`

### Step 1: Redirect the dashboard route

Replace the **entire** contents of `src/app/(app)/dashboard/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

// /dashboard merged into /decisions. Kept as a redirect for old bookmarks and
// any external (e.g. Slack digest) links.
export default function DashboardPage() {
  redirect("/decisions");
}
```

Delete `src/app/(app)/dashboard/loading.tsx` (a redirect-only route never shows it).

### Step 2: Drop the Health nav item

In `src/components/layout/sidebar.tsx`, remove the first `NAV_ITEMS` entry (`{ href: "/dashboard", label: "Health", icon: Activity }`). Remove the now-unused `Activity` import **only if** nothing else in the file uses it (grep first).

### Step 3: Repoint internal `/dashboard` links to `/decisions`

- `src/proxy.ts:31` - `new URL("/dashboard", req.nextUrl)` → `new URL("/decisions", req.nextUrl)` (post-login lands on the merged page, no redirect hop).
- `src/app/(app)/not-found.tsx:17` - `href="/dashboard"` → `href="/decisions"`.
- `src/components/layout/breadcrumbs.tsx:62` - `href="/dashboard"` → `href="/decisions"`. (Read surrounding code - if the label says "Health"/"Dashboard", update copy to "Decisions" to match.)
- `src/components/ui/shortcuts-overlay.tsx:67` - `router.push("/dashboard")` → `router.push("/decisions")`. (Update any visible shortcut label if it says "Go to Health".)

### Step 4: Gate

Run: `npx tsc --noEmit` → clean.
Run: `npm run lint` → no new errors.
Run: `npm run test:smoke` → 44 passing.

### Step 5: Commit

```bash
git add src/app/(app)/dashboard/page.tsx src/components/layout/sidebar.tsx src/proxy.ts src/app/(app)/not-found.tsx src/components/layout/breadcrumbs.tsx src/components/ui/shortcuts-overlay.tsx
git rm src/app/(app)/dashboard/loading.tsx
git commit -m "refactor: redirect /dashboard to /decisions; drop Health nav item"
```

---

## Task 5: Final gate + manual verification

### Step 1: Full gate

```bash
npx tsc --noEmit    # clean
npm run lint         # 4 pre-existing errors only (graph/app-shell) - no new ones
npm run test:smoke   # 44 passed
```

Report the delta against baseline (was 38 smoke / tsc clean / 4 lint errors).

### Step 2: Hand the user exact URLs/steps (no browser automation here)

Dev server: `npm run dev` → http://localhost:3000. Sign in `admin@acme.demo` / `password123`. Verify:

1. **http://localhost:3000/decisions** - health band on top (`% healthy` + distribution bar + clickable legend + decision-debt chip), attention quadrants below it, then the memory metrics strip (4 cells, **no** `% retrieval ready` badge), then search/filters/Focus chips, then the list. Header shows count, **no** `% memory` badge.
2. **http://localhost:3000/dashboard** - redirects to `/decisions`.
3. **Sidebar** - no "Health" item; 6 items; "Decisions" highlights on `/decisions`.
4. **Legend / quadrant links** - clicking e.g. "Review overdue" goes to `/decisions?review=due` / `?health=…` and the list filters while the band still reflects the whole workspace.
5. **Empty workspace** (a fresh workspace, 0 decisions) - no health band/memory strip; the "Start your decision log" empty state shows.
6. **Viewer role** - no New Decision button; "Read-only" tag; band/memory render read-only.
7. **Login redirect** - after sign-in you land on `/decisions` (no `/dashboard` flash).

### Step 3: Most-likely-wrong claim to call out

The aggregate `findMany` selects the fields `summarizeWorkspace` needs; if any decision field name differs in the Prisma schema (e.g. `problemStatement`), tsc catches it - but confirm the rendered counts match what the old `/dashboard` showed for the same workspace before declaring parity.

---

## Out of scope (do NOT touch)

- The 4 pre-existing lint errors in `graph` / `app-shell`.
- Restyling moved markup, the memory-card visual design, or the health algorithm.
- `docs/plans/2026-06-18-decision-health-block.md` (the stale plan targeting the wrong page).
- `dev.db.bak` (untracked; leave it).
