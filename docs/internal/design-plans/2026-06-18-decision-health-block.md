# Decision Health Block Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the lone health badge on the decision detail page with a full health block on top - a headline state, a count of signals needing attention, a per-signal checklist (owner / review / freshness / retro), and an inline action link per failing signal.

**Architecture:** Add one pure helper `computeHealthSignals` to `src/lib/decision-health.ts` (does NOT touch `computeDecisionHealth` - the precedence winner still drives the headline and every other consumer: list, dashboard, digest, analytics). Add one server component `HealthBlock` built only from existing primitives (`Row`, `Button`, `Dot`, `Text`). The detail page computes both and passes data down. Signals are derived, like health - no DB / API / migration changes.

**Tech Stack:** Next.js 16 (RSC), TypeScript strict, Tailwind, zero-dep smoke tests (`npx tsx tests/smoke/run.ts`).

---

## Baseline (do this first, before any edit)

Record the starting gate so "no regressions" means something.

Run:
```bash
npx tsc --noEmit
npm run lint
npm run test:smoke
```
Expected now: tsc clean, lint clean, smoke `N passed, 0 failed` (note N - the decision-health suite currently has 9 tests). Write the number down; every later step diffs against it.

---

## Task 1: `computeHealthSignals` helper

**Files:**
- Modify: `src/lib/decision-health.ts` (append after `computeDecisionHealth`, reuse `HEALTH_THRESHOLDS` + `DecisionHealthInput`)
- Test: `tests/smoke/decision-health.test.ts`

**Step 1: Write the failing tests**

Add `import { computeDecisionHealth, computeHealthSignals } from "../../src/lib/decision-health";` (replace the existing single-name import on line 1).

Add these entries to the `decisionHealthTests` object (helper to read a signal):

```ts
  "signals: orphaned active fails owner": () => {
    const s = computeHealthSignals(
      { status: "approved", ownerUserId: null, reviewDate: days(30), reviewedAt: null, updatedAt: NOW },
      NOW,
    );
    const owner = s.find((x) => x.key === "owner");
    assert(owner?.ok === false, `expected owner signal failing, got ${owner?.ok}`);
    assert(owner?.actionKey === "assign-owner", `expected assign-owner action, got ${owner?.actionKey}`);
  },

  "signals: overdue review fails review signal": () => {
    const s = computeHealthSignals(
      { status: "approved", ownerUserId: "u1", reviewDate: days(-10), reviewedAt: null, updatedAt: days(-10) },
      NOW,
    );
    assert(s.find((x) => x.key === "review")?.ok === false, "expected review signal failing");
  },

  "signals: healthy decision has zero failing": () => {
    const s = computeHealthSignals(
      { status: "approved", ownerUserId: "u1", reviewDate: days(30), reviewedAt: null, updatedAt: days(-5) },
      NOW,
    );
    assert(s.filter((x) => !x.ok).length === 0, `expected 0 failing, got ${s.filter((x) => !x.ok).length}`);
  },

  "signals: superseded without retro fails retro only": () => {
    const s = computeHealthSignals(
      { status: "superseded", ownerUserId: "u1", reviewDate: null, reviewedAt: null, updatedAt: days(-5), reviewCount: 0 },
      NOW,
    );
    assert(s.length === 1 && s[0].key === "retro" && s[0].ok === false, "expected single failing retro signal");
  },

  "signals: archived carries no signals": () => {
    const s = computeHealthSignals(
      { status: "archived", ownerUserId: null, reviewDate: null, reviewedAt: null, updatedAt: days(-500) },
      NOW,
    );
    assert(s.length === 0, `expected 0 signals, got ${s.length}`);
  },
```

**Step 2: Run to verify it fails**

Run: `npm run test:smoke`
Expected: FAIL - `computeHealthSignals is not a function` (or tsc/import error).

**Step 3: Write minimal implementation**

Append to `src/lib/decision-health.ts`:

```ts
export type HealthSignalKey = "owner" | "review" | "freshness" | "retro";
export type HealthSignalAction = "assign-owner" | "schedule-review" | "do-review" | "submit-retro";

export interface HealthSignal {
  key: HealthSignalKey;
  ok: boolean;
  label: string;
  detail: string;
  actionKey?: HealthSignalAction;
}

/**
 * The per-decision breakdown behind the single `computeDecisionHealth` state.
 * Each signal mirrors one precedence rule so the checklist and the headline
 * never disagree. Neutral states (archived) carry no actionable signals;
 * superseded carries only the retro signal.
 */
export function computeHealthSignals(d: DecisionHealthInput, now: Date = new Date()): HealthSignal[] {
  if (d.status === "archived") return [];

  if (d.status === "superseded") {
    const hasRetro = !!d.reviewedAt || (d.reviewCount ?? 0) > 0;
    return [
      {
        key: "retro",
        ok: hasRetro,
        label: "Retro captured",
        detail: hasRetro
          ? "A review explains why this was replaced."
          : "Replaced, but no one captured why the original broke.",
        actionKey: hasRetro ? undefined : "submit-retro",
      },
    ];
  }

  const hasOwner = !!d.ownerUserId;
  const overdue = !!d.reviewDate && !d.reviewedAt && d.reviewDate.getTime() < now.getTime();
  const staleMs = HEALTH_THRESHOLDS.STALE_DAYS * 24 * 60 * 60 * 1000;
  const fresh = !!d.reviewDate || now.getTime() - d.updatedAt.getTime() <= staleMs;

  return [
    {
      key: "owner",
      ok: hasOwner,
      label: "Owner assigned",
      detail: hasOwner ? "Someone is accountable for this decision." : "No owner - nobody is accountable.",
      actionKey: hasOwner ? undefined : "assign-owner",
    },
    {
      key: "review",
      ok: !overdue,
      label: "Review on schedule",
      detail: overdue ? "The scheduled review date has passed." : "No overdue review.",
      actionKey: overdue ? "do-review" : undefined,
    },
    {
      key: "freshness",
      ok: fresh,
      label: "Fresh",
      detail: fresh ? "Reviewed or edited recently." : "No review set and no edits in 90+ days.",
      actionKey: fresh ? undefined : "schedule-review",
    },
  ];
}
```

**Step 4: Run to verify it passes**

Run: `npm run test:smoke`
Expected: PASS - `N+5 passed, 0 failed`.

**Step 5: Commit**

```bash
git add src/lib/decision-health.ts tests/smoke/decision-health.test.ts
git commit -m "feat(health): add computeHealthSignals per-decision breakdown"
```

---

## Task 2: `HealthBlock` component

**Files:**
- Create: `src/components/decisions/health-block.tsx`

No standalone test - it's a pure-presentation RSC; `tsc --noEmit` is the gate. (Smoke suite is for pure logic only, per CONTRIBUTING.)

**Step 1: Write the component**

```tsx
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Row } from "@/components/ui/row";
import { Button } from "@/components/ui/button";
import { Dot } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { HEALTH_META, type DecisionHealth, type HealthSignal, type HealthSignalAction } from "@/lib/decision-health";

const ACTION_TARGETS: Record<HealthSignalAction, { label: string; href: (id: string) => string }> = {
  "assign-owner": { label: "Assign owner", href: (id) => `/decisions/${id}/edit` },
  "schedule-review": { label: "Schedule review", href: (id) => `/decisions/${id}/edit` },
  "do-review": { label: "Do review", href: () => "#submit-review" },
  "submit-retro": { label: "Submit retro", href: () => "#submit-review" },
};

export function HealthBlock({
  decisionId,
  health,
  signals,
}: {
  decisionId: string;
  health: DecisionHealth;
  signals: HealthSignal[];
}) {
  const meta = HEALTH_META[health];
  const failing = signals.filter((s) => !s.ok).length;

  return (
    <div className={cn("rounded-xs border p-5", meta.tone)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-2">
          <Dot className={meta.dot} />
          <Text weight="medium">{meta.label}</Text>
        </span>
        <Text size="xs" color="subtle">
          {failing === 0 ? "All signals healthy" : `${failing} signal${failing === 1 ? "" : "s"} need attention`}
        </Text>
      </div>
      <Text as="p" size="xs" color="subtle">{meta.hint}</Text>

      {signals.length > 0 && (
        <div className="mt-4 space-y-1">
          {signals.map((s) => {
            const action = !s.ok && s.actionKey ? ACTION_TARGETS[s.actionKey] : null;
            return (
              <Row
                key={s.key}
                wrap
                leading={
                  s.ok ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <X className="h-4 w-4 text-rose-600" />
                  )
                }
                title={s.label}
                subtitle={s.detail}
                trailing={
                  action ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={action.href(decisionId)}>{action.label}</Link>
                    </Button>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean. If `Text` rejects `weight`/`size`/`color`, open `src/components/ui/text.tsx` and match the real prop names (these are the names used in `src/components/ui/row.tsx:55-58`, so they should match).

**Step 3: Commit**

```bash
git add src/components/decisions/health-block.tsx
git commit -m "feat(health): add HealthBlock component"
```

---

## Task 3: Wire into the decision detail page

**Files:**
- Modify: `src/app/(app)/decisions/[id]/page.tsx`

**Step 1: Imports**

- Line 7 `import { Badge, Dot } from "@/components/ui/badge";` → `import { Badge } from "@/components/ui/badge";`
- Line 8 `import { computeDecisionHealth, HEALTH_META } from "@/lib/decision-health";` → `import { computeDecisionHealth, computeHealthSignals } from "@/lib/decision-health";`
- Add: `import { HealthBlock } from "@/components/decisions/health-block";`

**Step 2: Compute signals, drop healthMeta**

Replace the block at lines 142-150 (`const health = computeDecisionHealth({...}); const healthMeta = HEALTH_META[health];`) with:

```ts
  const healthInput = {
    status: decision.status,
    ownerUserId: decision.ownerUserId,
    reviewDate: decision.reviewDate,
    reviewedAt: decision.reviewedAt,
    updatedAt: decision.updatedAt,
    reviewCount: decision.reviews.length,
  };
  const health = computeDecisionHealth(healthInput);
  const signals = computeHealthSignals(healthInput);
```

**Step 3: Remove the header health badge**

Delete lines 192-194 (the `<Badge className={healthMeta.tone} ...>{healthMeta.label}</Badge>`). Keep the status badge and the blast-radius badge.

**Step 4: Render the block**

After the header `</div>` (currently line 279) and before `<Separator />` (line 281), insert:

```tsx
      <HealthBlock decisionId={id} health={health} signals={signals} />
```

**Step 5: Add the retro anchor**

The "Submit a review" `Section` (line 380-384) is the `do-review` / `submit-retro` target. `Section` has no `id` prop, so wrap it:

```tsx
          {!isViewer && (
            <div id="submit-review">
              <Section title="Submit a review" icon={ClipboardCheck}>
                <ReviewForm decisionId={id} />
              </Section>
            </div>
          )}
```

Note: when a decision is read-only (viewer) the review form isn't rendered, so the `do-review`/`submit-retro` anchor won't exist - but viewers also can't act on it, so the dangling `#submit-review` is harmless (scrolls nowhere). Acceptable; no extra branching.

**Step 6: Gate**

Run:
```bash
npx tsc --noEmit
npm run lint
npm run test:smoke
```
Expected: tsc clean (no unused `Dot`/`HEALTH_META`/`healthMeta` - if lint flags an unused import, remove it), lint clean, smoke `N+5 passed, 0 failed` - same +5 as Task 1, no new failures.

**Step 7: Commit**

```bash
git add "src/app/(app)/decisions/[id]/page.tsx"
git commit -m "feat(health): promote health badge to full block on decision page"
```

---

## Task 4: Visual verification (manual - the user's to run)

`tsc`/lint/smoke prove the logic and types, not the rendered block. Verify in the running app:

```bash
npm run dev   # http://localhost:3001
```

Open a decision in each of these states and confirm the block reads correctly:
- A healthy decision → green-ish block, "All signals healthy", three checks.
- An orphaned decision (no owner) → owner row shows ✗ + "Assign owner" → lands on `/edit`.
- An overdue decision → review row ✗ + "Do review" → scrolls to the review form (`#submit-review`).
- A superseded-without-retro decision → single retro row ✗ + "Submit retro".
- An archived decision → headline only, no checklist.

The one claim most likely to be wrong: `Text`'s prop names (`weight`/`size`/`color`) - tsc will catch a mismatch in Task 2, but confirm the rendered styling looks right.

---

## Out of scope (YAGNI - say so, don't build)

- Workspace-level tally already lives on the dashboard (`dashboard/page.tsx`). Not duplicated onto the decision page.
- No new constants - signals reuse `HEALTH_THRESHOLDS`.
- No change to `computeDecisionHealth` or any other consumer.
