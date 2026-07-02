# Workspace health block - unify the layout

**Date:** 2026-06-18
**Scope:** `src/components/decisions/workspace-health.tsx` only. No changes to
`decision-health.ts` (the 8 states) or `workspace-summary.ts` (the aggregator).

## Problem

The health block renders two different ways depending on data:

- When `totalAttention === 0`, the four attention cards are replaced wholesale
  by a single "Nothing rotting today" panel.
- When `totalAttention > 0`, the four cards appear, each with its own empty/
  populated treatment.

So the block's shape changes with its contents. Same concept, two layouts.

## The 8 states (unchanged)

| State | Has a card? |
|---|---|
| `superseded-unreviewed` | ✅ |
| `review-overdue` | ✅ |
| `stale` | ✅ |
| `orphaned` | ✅ |
| `review-due-soon` | bar/legend only |
| `superseded` (w/ retro) | bar/legend only |
| `archived` | bar/legend only |
| `healthy` | bar/legend only |

The four attention states are the actionable ones; the other four stay in the
headline bar + legend as before. This split is unchanged.

## Decision

Keep the same elements; stop reshaping the block.

1. **Always render all four attention cards** - even when every count is 0.
   Drop the whole-block "Nothing rotting today" swap.
2. **One status line on top of the cards** - summarizes the cards below:
   - all four counts `0` → `Nothing rotting today.`
   - otherwise → `{totalAttention} decision(s) need attention.`
3. **Per-card behavior is unchanged** - a count-0 card keeps its current
   "All clear" + green-icon treatment (deliberately left as-is).

Result: the block is always headline → status line → 4 cards → tip, regardless
of data. The four elements inside never appear or disappear.

## Layout (always, in this order)

```
[ headline %  +  distribution bar  +  legend ]   (unchanged)
[ status line: "Nothing rotting today." | "N decisions need attention." ]
[ card ][ card ]
[ card ][ card ]                                  (always all 4, 2-col grid)
[ tip line ]                                      (unchanged)
```

## Implementation notes

- Remove the `totalAttention === 0 ? <NothingRotting/> : <grid/>` conditional.
  The 2-col grid of four `AttentionList`s renders unconditionally.
- Add a status line above the grid driven by `totalAttention`:
  - `0` → "Nothing rotting today."
  - `> 0` → pluralized "{n} decision(s) need attention."
- The `ShieldCheck` icon + emerald tone from the old empty panel can move onto
  the status line when `totalAttention === 0` for the calm/all-clear cue.

## Out of scope (named, not done)

- Icon color flipping green on count 0 - kept as-is per decision.
- Color-vs-severity mismatch (orphaned slate while counted unhealthy; gray bar
  at 0% healthy) - not addressed here.
- Two visual languages (legend dot vs card icon) - not addressed here.
- Inconsistent links (`?review=due` vs `?health=<state>`) - not addressed here.

These are real but separate; this change only unifies the block's shape.
