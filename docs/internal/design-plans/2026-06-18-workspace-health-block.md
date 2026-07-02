# Workspace Health Block - Unify Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the workspace health block render the same shape regardless of data - always show all 4 attention cards, with one summary status line above them.

**Architecture:** Single-component edit to `workspace-health.tsx`. Remove the `totalAttention === 0 ? <panel> : <grid>` branch so the 4-card grid always renders. Add a status line above the grid driven by `totalAttention`. No changes to `decision-health.ts` (8 states) or `workspace-summary.ts` (aggregator) - the data is already available on `summary`.

**Tech Stack:** Next.js 16 RSC, React, Tailwind, lucide-react. The `Row` and `Text` primitives from `src/components/ui/`.

**Verification:** This is a presentational change with no new pure-function logic, so the gate is `npx tsc --noEmit` + `npm run lint` + a visual check at both data states (all-clear and has-attention). No smoke test is added - the project only smoke-tests `lib/` pure functions and none changed here.

---

### Task 1: Always render the 4 cards + add the status line

**Files:**
- Modify: `src/components/decisions/workspace-health.tsx:88-142`

**Reference (design doc):** `docs/plans/2026-06-18-workspace-health-block-design.md`

**Step 1: Capture the baseline**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass (clean tree before edit). Record any pre-existing warnings so they aren't blamed on this change.

**Step 2: Replace the conditional block**

In `workspace-health.tsx`, the current block (lines ~88-142) is:

```tsx
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
          <AttentionList ... />   {/* superseded-unreviewed */}
          <AttentionList ... />   {/* review-overdue */}
          <AttentionList ... />   {/* stale */}
          <AttentionList ... />   {/* orphaned */}
        </div>
      )}
```

Replace the whole conditional with an always-on status line followed by the always-on grid:

```tsx
      {/* Status line - summarizes the cards below */}
      <div className="rounded-xs transition-all duration-200 px-2 py-1.5">
        <Row
          wrap
          leading={
            totalAttention === 0 ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )
          }
          title={
            <Text>
              {totalAttention === 0
                ? "Nothing rotting today."
                : `${totalAttention} ${totalAttention === 1 ? "decision needs" : "decisions need"} attention.`}
            </Text>
          }
        />
      </div>

      {/* Attention quadrants - always all four */}
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
```

Note: `ShieldCheck` and `AlertTriangle` are already imported at the top of the file - no import changes needed. `totalAttention` is already destructured from `summary`.

**Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass, no new warnings vs the Step 1 baseline.

**Step 4: Visual check - has-attention state**

Run: `npm run dev` (port 3001). Sign in (`admin@acme.demo` / `password123`), open `/decisions` with a workspace that has at least one orphaned/overdue/stale/superseded-unreviewed decision (the seeded "poop / unassigned" orphaned decision works).
Expected:
- Status line reads "1 decision needs attention." with the amber `AlertTriangle`.
- All 4 cards visible below it; the populated card shows its item, the other 3 show "All clear."

**Step 5: Visual check - all-clear state**

Open `/decisions` for a workspace where all 4 attention counts are 0 (assign the orphaned decision an owner, or use a clean workspace).
Expected:
- Status line reads "Nothing rotting today." with the emerald `ShieldCheck`.
- All 4 cards still visible, each showing "All clear." The block shape is identical to the has-attention state.

**Step 6: Commit**

```bash
git add src/components/decisions/workspace-health.tsx docs/plans/2026-06-18-workspace-health-block.md docs/plans/2026-06-18-workspace-health-block-design.md
git commit -m "refactor(ui): always render health cards under one status line"
```

---

## Done when

- `tsc` + `lint` pass with no new warnings vs baseline.
- Both data states (all-clear, has-attention) render the same 4-card layout under one status line - confirmed visually, not just compiled.
- No edits outside `workspace-health.tsx` (plus the two plan docs).
