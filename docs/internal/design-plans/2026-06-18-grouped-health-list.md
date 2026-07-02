# Grouped Health Decision List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the two health scorecards on `/decisions` (4 attention cards + 4 memory stats) with a thin header (% bar + one coverage line) and group the existing decision list by health state with header separators.

**Architecture:** Export `HEALTH_DISPLAY_ORDER` from `decision-health.ts` so both the header and the page can share it. Slim `WorkspaceHealth` to just the headline bar + a coverage line. In `decisions/page.tsx`, bucket the already-filtered `decisions` by `computeDecisionHealth`, iterate the health order worst-first, and render a group header + that bucket's rows; empty groups render only in the unfiltered default view. Remove the `MemoryMetric` block + component. No change to `decision-health.ts` rules or `summarizeWorkspace`.

**Tech Stack:** Next.js 16 RSC, React, Tailwind, lucide-react, `Text`/`Badge`/`Dot` primitives in `src/components/ui/`.

**Design doc:** `docs/plans/2026-06-18-health-coverage-strip-design.md`

**Testing note:** Presentational change, **no new pure-function logic** (data comes from the unchanged `summarizeWorkspace` + `computeDecisionHealth`). Per project convention only `lib/` pure functions get smoke tests → **no unit test added**. Gate = `npx tsc --noEmit` + `npm run lint` (no new problems vs baseline) + a **live render check at both data states** confirmed in server-rendered HTML with a clean dev-server console - not just a passing compile.

**Working-tree note:** `src/components/decisions/workspace-health.tsx` currently has an uncommitted, superseded edit (a status line + always-4-cards). Task 2 **overwrites the whole file**, discarding that - expected.

**Baseline to diff against (recorded 2026-06-18):**
- `npx tsc --noEmit` → passes.
- `npm run lint` → 6 pre-existing problems (4 errors, 2 warnings) in `src/app/api/decisions/search/route.ts`, `src/components/graph/decision-graph-canvas.tsx`, `src/components/layout/app-shell.tsx`. **Zero** in the files this plan touches.

---

### Task 1: Export `HEALTH_DISPLAY_ORDER` from `decision-health.ts`

**Files:**
- Modify: `src/lib/decision-health.ts`

**Step 1: Record the baseline**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc passes; lint = the 6 pre-existing problems, none in `decision-health.ts`.

**Step 2: Add the exported constant**

In `src/lib/decision-health.ts`, immediately **after** the `HEALTH_META` declaration (the `export const HEALTH_META: Record<...> = { ... };` block ending around line 125), add:

```ts
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
```

**Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc passes; lint unchanged (6 baseline, none new).

**Step 4: Commit**

```bash
git add src/lib/decision-health.ts
git commit -m "refactor: export HEALTH_DISPLAY_ORDER from decision-health"
```

---

### Task 2: Slim `WorkspaceHealth` to a thin header + coverage line

**Files:**
- Overwrite: `src/components/decisions/workspace-health.tsx`

**Step 1: Replace the whole file**

Overwrite `src/components/decisions/workspace-health.tsx` with exactly:

```tsx
import Link from "next/link";
import { Text } from "@/components/ui/text";
import {
  HEALTH_META,
  HEALTH_DISPLAY_ORDER,
  type DecisionHealth,
} from "@/lib/decision-health";
import type { WorkspaceSummary } from "@/lib/workspace-summary";

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
  const { counts, total, activeTotal, inactive, healthyShare, memory } = summary;

  return (
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

      {/* Coverage line - completeness across the workspace */}
      <div className="mt-3">
        <Text as="p">
          Rationale {memory.withRationale}/{total} · Owners {memory.withOwner}/{total} · Review{" "}
          {memory.withReviewDate}/{total}
        </Text>
      </div>
    </div>
  );
}
```

This drops the attention cards, the `AttentionList` component, the tip `Row`, and their now-unused imports (`ShieldCheck`, `AlertTriangle`, `Hourglass`, `Clock`, `Ghost`, `Users`, `ArrowRight`, `Row`, `formatRelativeDate`, `AttentionItem`).

**Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc passes; lint = 6 baseline, none new, none in `workspace-health.tsx`.

**Step 3: Commit**

```bash
git add src/components/decisions/workspace-health.tsx
git commit -m "refactor(ui): slim WorkspaceHealth to header + coverage line"
```

---

### Task 3: Group the decision list and remove `MemoryMetric` in `decisions/page.tsx`

**Files:**
- Modify: `src/app/(app)/decisions/page.tsx`

**Step 1: Import the display order**

In the `@/lib/decision-health` import (currently `computeDecisionHealth`, `HEALTH_META`, `type DecisionHealth`), add `HEALTH_DISPLAY_ORDER`:

```tsx
import {
  computeDecisionHealth,
  HEALTH_META,
  HEALTH_DISPLAY_ORDER,
  type DecisionHealth,
} from "@/lib/decision-health";
```

**Step 2: Build the groups**

Just before the `return (` of the page component (after the `checklist` array, ~line 290), add:

```tsx
  const decisionGroups = HEALTH_DISPLAY_ORDER.map((health) => ({
    health,
    meta: HEALTH_META[health],
    items: decisions.filter(
      (d) =>
        computeDecisionHealth({
          status: d.status,
          ownerUserId: d.ownerUserId,
          reviewDate: d.reviewDate,
          reviewedAt: d.reviewedAt,
          updatedAt: d.updatedAt,
          reviewCount: d._count.reviews,
        }) === health,
    ),
  })).filter((g) => g.items.length > 0 || !hasFilters);
```

(`hasFilters` is already defined above. When a filter/search is active, empty groups are suppressed; in the default view all 8 groups render.)

**Step 3: Replace the flat list branch with grouped rendering**

Replace the **final** `: (` branch of the list (the `<div className="rounded-xs transition-all duration-200 overflow-hidden">` … `</div>` that wraps `decisions.map(...)`, currently lines ~444-528) with:

```tsx
      ) : (
        <div className="rounded-xs transition-all duration-200 overflow-hidden">
          {decisionGroups.map((g) => (
            <div key={g.health}>
              <div className="flex items-center gap-2 bg-slate-50 px-5 py-2">
                <Dot className={g.meta.dot} />
                <Text as="p">{g.meta.label}</Text>
                <Text as="span">{g.items.length}</Text>
              </div>
              {g.items.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {g.items.map((d) => {
                    const isOverdue =
                      d.reviewDate &&
                      new Date(d.reviewDate) <= now &&
                      !d.reviewedAt &&
                      d.status !== "archived" &&
                      d.status !== "superseded";
                    const m = g.meta;
                    const context = d.rationale ?? d.problemStatement ?? d.chosenOption;
                    const contextLabel = d.rationale
                      ? "Why"
                      : d.problemStatement
                      ? "Problem"
                      : d.chosenOption
                      ? "Decision"
                      : "Missing rationale";

                    return (
                      <Link
                        key={d.id}
                        href={`/decisions/${d.id}`}
                        prefetch={false}
                        className="block px-5 py-4 transition-all hover:bg-blue-50/40 group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <Text as="p">{d.title}</Text>
                              {isOverdue && (
                                <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-text-warning">
                                  <Clock className="h-3 w-3" />
                                  <Text as="span">Review due</Text>
                                </span>
                              )}
                            </div>
                            <Text as="p">
                              <Text>{contextLabel}:</Text>{" "}
                              {context ?? "Add the reasoning so this record is useful six months from now."}
                            </Text>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <Text>{d.owner?.name ?? d.createdBy.name}</Text>
                              <Text>{formatRelativeDate(d.updatedAt)}</Text>
                              {d.reviewDate && <Text>Review {formatDate(d.reviewDate)}</Text>}
                              {d._count.notes > 0 && (
                                <Text>
                                  {d._count.notes} note{d._count.notes !== 1 ? "s" : ""}
                                </Text>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 flex-col items-end gap-1 pt-0.5">
                            <Badge className={STATUS_COLORS[d.status] ?? "bg-slate-100 text-slate-600"}>
                              {getLabelForValue(STATUSES, d.status)}
                            </Badge>
                            <Badge className={m.tone} title={m.hint} icon={<Dot className={m.dot} />}>
                              {m.label}
                            </Badge>
                            {d.outcomeStatus !== "unknown" && (
                              <Badge className={OUTCOME_COLORS[d.outcomeStatus] ?? "bg-slate-100 text-slate-600"}>
                                {getLabelForValue(OUTCOME_STATUSES, d.outcomeStatus)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="px-5 py-3">
                  <Text as="p">All clear.</Text>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
```

The row markup is the existing one verbatim, except the per-row health is no longer recomputed - `m = g.meta` (the row's health equals its group's). The `isFirstVisit` and `decisions.length === 0` branches above this stay unchanged.

**Step 4: Remove the `MemoryMetric` scorecard block**

Delete the `{totalCount > 0 && ( … )}` block rendering the four `MemoryMetric`s (the `<div className="overflow-hidden rounded-xs border …">` wrapper through its closing `)}`, currently ~lines 333-366). The `{totalCount > 0 && <WorkspaceHealth summary={summary} />}` line directly above stays.

**Step 5: Remove the `MemoryMetric` component**

Delete the `function MemoryMetric({ … }) { … }` definition (~lines 60-85).

**Step 6: Remove now-unused imports**

After Steps 4-5, `Lightbulb`, `UserCheck`, `ClipboardCheck` are unused. Remove those three from the lucide import block (~lines 13-24). **Keep** `Clock` (used in the row "Review due" pill ~line 487 / new row) and `Activity` (used ~line 392).

**Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc passes (no "declared but never used" / "cannot find name"). Lint = 6 baseline, none new, none in `decisions/page.tsx`. Fix any unused-symbol the typecheck names in this file.

**Step 8: Commit**

```bash
git add "src/app/(app)/decisions/page.tsx"
git commit -m "feat(ui): group the decisions list by health; drop MemoryMetric scorecard"
```

---

### Task 4: Live verification at both data states

**Files:** none (verification only)

**Pre-req:** dev server on port 3000 (PID 76039 this session). `acme-demo` is seeded with an orphaned decision ("poop"); the `test` workspace is all-clear (1 healthy decision). Authenticated HTML can be fetched with a `jose`-minted session JWT (harness used earlier; tokens at `/tmp/session.token` for acme-demo, `/tmp/session.test.token` for test - re-mint if expired).

**Step 1: has-attention state (acme-demo)**

Fetch `http://localhost:3000/decisions` with the acme-demo cookie. In the server-rendered HTML confirm:
- Thin header: the `N%` line, distribution bar, legend, and the `Rationale x/y · Owners x/y · Review x/y` coverage line are present.
- The decision list shows **group header separators** (e.g. `Orphaned` with a count and dot) with the `poop` row under the Orphaned group.
- The old `MemoryMetric` text (`the load-bearing field`, `keeps memory current`) is **absent**.
- The old attention-card / tip text (`Future you will thank you`, `Nothing rotting`) is **absent**.

**Step 2: all-clear state (test workspace)**

Fetch `/decisions` with the test cookie. Confirm:
- Thin header renders.
- Default (no filters) view shows **all** group headers; non-`Healthy` groups show `(0)` + an `All clear.` line; the one decision sits under its group.

**Step 3: filtered view suppresses empty groups**

Fetch `/decisions?health=stale` (acme-demo cookie). Confirm only the `Stale` group renders (no empty `Healthy (0)` etc. headers).

**Step 4: dev-server console is clean**

Diff `.next/dev/logs/next-development.log` across the fetches; confirm **no new** `"level":"ERROR"` lines from these renders (ignore pre-existing stale errors from earlier in the session - compare against a captured line offset).

**Step 5: manual user confirmation**

Report the verified facts and hand to the user for an in-browser visual check (hydration/visual styling is the one thing server-HTML can't confirm):
- `admin@acme.demo` / `password123` → `/decisions` → thin header + grouped list with the Orphaned group.
- `test` workspace → all group headers, empty ones showing `All clear.`

Do not call the task done until the user confirms the visual.

---

## Done when

- `npx tsc --noEmit` and `npm run lint` pass with no new problems vs baseline.
- `/decisions` shows a thin header (% bar + coverage line) and a single decision list **grouped by health** with worst-first separators; the 4 attention cards, the tip, and the `MemoryMetric` scorecard are gone.
- Default view shows all group headers (empty ones `All clear.`); filtered/search views show only matching groups - both confirmed in live server-rendered HTML with a clean console, then visually confirmed by the user.
- No edits outside the three source files named (plus the plan/design docs).

## Rollback

Three commits on `oleg` (`decision-health.ts`, `workspace-health.tsx`, `page.tsx`) plus this plan. `git revert` the three to restore the prior two-scorecard layout. No data/schema changes.
