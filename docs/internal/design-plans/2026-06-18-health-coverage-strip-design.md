# Workspace Health - Group the decision list by health (drop the cards + scorecard)

**Date:** 2026-06-18
**Status:** Design locked (brainstormed). Supersedes the "always-render-4-cards" plan (`2026-06-18-workspace-health-block.md`, never committed) **and** the earlier "coverage strip" idea (this file's previous revision). The strip implementation plan `2026-06-18-health-coverage-strip.md` is now **stale** - regenerate it from this design.

---

## Problem

`/decisions` stacks **two health scorecards** above the decision list:

1. **WorkspaceHealth** (`workspace-health.tsx`): headline `N% healthy` + distribution bar + legend, then **4 attention cards** (Superseded-without-retro / Review overdue / Stale / Orphaned), then a tip line.
2. **Memory metrics** (`decisions/page.tsx`, `MemoryMetric` ×4): with-rationale / owned / review-scheduled / needs-review.

These overlap (evidence in `src/lib/workspace-summary.ts`): line 138 `memory.overdueReviews = counts["review-overdue"]` is the same number as the "Review overdue" card; `withOwner` is the inverse of the Orphaned card. And **the decision list below already shows each decision's health** as a per-row badge (`page.tsx:513`) - so the cards re-summarize data the list already carries.

## Goal

Delete the two top scorecards. **Group the existing all-decisions list by health state** with header separators, so the list itself is the health view. Keep only a thin header (overall % + compact coverage line). Less code, no duplicated summary.

## Design

### 1. Thin header (slim down `WorkspaceHealth`)

`WorkspaceHealth` renders **only** the header now:

- **Keep:** `N% of active decisions are healthy` + the distribution bar + the clickable legend (existing, unchanged - `workspace-health.tsx` lines ~44-86).
- **Add:** one compact **coverage line** below the legend (plain inline text, `·`-separated), from `summary.memory`:
  `Rationale {withRationale}/{total} · Owners {withOwner}/{total} · Review {withReviewDate}/{total}`
- **Remove:** the 4 attention cards, the `AttentionList` component, and the tip `Row`.

### 2. Group the decision list (in `decisions/page.tsx`)

Replace the flat `decisions.map(...)` (lines ~447-525) with a grouped render:

- Compute each decision's health (`computeDecisionHealth`, already done inline at ~454) and bucket decisions by `DecisionHealth`.
- Iterate the existing **`HEALTH_DISPLAY_ORDER`** (worst-first: `superseded-unreviewed`, `review-overdue`, `stale`, `orphaned`, `review-due-soon`, `superseded`, `archived`, `healthy`) - *(note: that constant currently lives in `workspace-health.tsx`; move it to a shared spot or redefine it in `page.tsx`)*.
- For each health state, render a **group header separator** (health label + count + the `HEALTH_META[h].dot` color), then that bucket's rows.
- **Row layout is unchanged** - keep the existing row markup including the per-row health badge, status badge, outcome badge, and the "Review due" pill.
- **Within a group:** preserve the existing decision order (the query's sort).

### 3. Empty-group rule

- **Default view (no filter/search active):** render **every** group header, including empty ones. An empty group shows its header with `(0)` and a single `All clear.` line, no rows. (This is the "keep empty groups always visible for now" decision - no toggle, no persistence.)
- **When a filter or search is active** (`hasFilters`): render **only** groups that have ≥1 matching decision - no empty headers cluttering a filtered result. A single-health filter (`?health=stale`) naturally collapses to one group.

## Removed

- `workspace-health.tsx`: the 4 attention cards, the `AttentionList` function, the tip `Row` (+ now-unused imports: `ShieldCheck`, `Users`, `Ghost`, `Hourglass`, etc. - let typecheck/lint name them).
- `decisions/page.tsx`: the 4-stat `MemoryMetric` block (~lines 333-366) **and** the `MemoryMetric` function (~lines 60-85), plus now-unused imports `Lightbulb`, `UserCheck`, `ClipboardCheck`. **Keep** `Clock` (used at ~487) and `Activity` (used at ~392).

**Not doing** the earlier coverage-strip idea - no `Badge` `tone` prop, no 6-chip strip. The group headers + per-row badges carry the rot signal; the thin coverage line carries completeness.

## What is NOT redundant after the change

- Thin header = workspace rollup (% + coverage). Group headers = per-state counts. Rows = the decisions. Each level adds detail; no level repeats another's summary as a separate widget.
- `overdueReviews` standalone stat is gone but still reachable via the existing **"Needs review (N)"** quick-filter below the search bar, and visible as the "Review overdue" group.

## State space (enumerate; intended behavior)

| Case | Behavior |
|---|---|
| `totalCount === 0` (first visit) | `WorkspaceHealth` not rendered (`page.tsx` gates `totalCount > 0`); existing `EmptyState` shows. Unchanged. |
| Default view, mixed health | Thin header; all 8 group headers in worst-first order; empty groups show `(0) · All clear.` |
| Default view, everything healthy | Header shows 100%; only `Healthy` group has rows; the 7 other group headers show `(0) · All clear.` |
| Filter/search active | Thin header; **only** groups with matching rows; no empty headers. `decisions.length === 0` → existing "No decisions match" `EmptyState`. |
| `?health=<state>` filter | One group (that state); header optional/redundant but harmless. |
| Single decision workspace | One group with one row; other headers `(0)` (default view). |

## Open considerations (resolved / accepted)

1. **Empty non-attention headers (`Healthy (0)`, `Superseded (0)`, `Archived (0)`) add noise in the default view.** Accepted "for now" per user. Possible later refinement: always show the 4 attention groups, but hide empty `healthy/superseded/archived/review-due-soon`. Not in scope now.
2. **`HEALTH_DISPLAY_ORDER` location.** Currently in `workspace-health.tsx`. Since `page.tsx` now needs it, either export it from a shared module (e.g. `decision-health.ts`) or redefine locally. Decide at build (lean: export from `decision-health.ts` alongside `HEALTH_META`).

## Non-goals

- No change to `decision-health.ts` health rules (8 states) or `summarizeWorkspace` aggregator - all data already available.
- No new pure-function logic → no new smoke test (project only smoke-tests `lib/` pure fns).
- No persistence / user settings / new API routes / schema changes.

## Verification (same gate as prior plans)

1. `npx tsc --noEmit` - passes, no suppressions.
2. `npm run lint` - no new problems vs baseline (6 pre-existing: `search/route.ts`, `decision-graph-canvas.tsx`, `app-shell.tsx`).
3. Live render at both data states (has-attention via `acme-demo`, all-clear via the clean `test` workspace), confirmed in server-rendered HTML + clean dev-server console, then user visual confirmation.

## Files touched

- `src/components/decisions/workspace-health.tsx` (slim to thin header + coverage line; remove cards/tip)
- `src/app/(app)/decisions/page.tsx` (group the list; remove `MemoryMetric`; remove unused imports)
- *(maybe)* `src/lib/decision-health.ts` (export `HEALTH_DISPLAY_ORDER` if shared)
