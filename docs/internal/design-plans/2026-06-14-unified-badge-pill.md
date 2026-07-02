# Unified Badge Pill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace 5 badge wrapper components with one dumb, fully-configurable `Badge` pill, migrate all ~35 call sites to configure it inline, and consolidate Storybook into a single story file showing every configuration.

**Architecture:** One presentational `Badge` in `src/components/ui/badge.tsx` with optional `icon` / `size` / `href` / `title`. A tiny `Dot` icon component lives beside it ("a dot is an icon"). No `useCase` prop, no registry, no wrappers - the programmer reads existing lib data (`STATUS_COLORS`, `HEALTH_META`, `computeDecisionHealth`, …) and passes colors + icon as attributes at each call site.

**Tech Stack:** Next.js 16, React Server Components, Tailwind, `tailwind-merge` via `cn()`, Storybook 10 (`@storybook/nextjs`, CSF3), `lucide-react`.

**Verification model:** There is no component unit-test runner (smoke tests cover only `src/lib` pure functions). Per-task gate is `npx tsc --noEmit`. The `HEALTH_META` change runs `npm run test:smoke`. Final gate = `tsc` + `npm run lint` + `npm run test:smoke` + visual check in Storybook.

**Accepted visual delta (intended unification):** all pills now share one base style (`font-semibold tracking-wide`, `px-2.5 py-[3px]` at `sm`). The 3 health/blast pills previously used `font-medium` / `px-2 py-0.5` and will shift slightly. This is the point of unifying. Spot-check it's acceptable in Storybook.

**Rollback:** all work on a worktree branch; abandon the branch to undo. Each task commits separately.

---

### Task 1: Enhance `Badge` and add `Dot`

**Files:**
- Modify: `src/components/ui/badge.tsx` (full rewrite, 21 lines → ~55)

**Step 1: Rewrite the component**

Replace the entire file with:

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-2.5 py-[3px] text-xs",
} as const;

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline";
  size?: "xs" | "sm";
  icon?: React.ReactNode;
  href?: string;
  title?: string;
}

export function Badge({
  children,
  className,
  variant = "outline",
  size = "sm",
  icon,
  href,
  title,
}: BadgeProps) {
  const classes = cn(
    "inline-flex items-center gap-1 rounded-full border font-semibold tracking-wide",
    SIZES[size],
    variant === "outline"
      ? "bg-transparent"
      : "bg-indigo-50 text-indigo-700 border-indigo-100",
    className
  );

  const content = (
    <>
      {icon}
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} title={title} className={cn(classes, "hover:underline")}>
        {content}
      </Link>
    );
  }

  return (
    <span className={classes} title={title}>
      {content}
    </span>
  );
}

/** A colored dot - an icon you drop into `Badge`'s `icon` slot. */
export function Dot({ className }: { className?: string }) {
  return <span className={cn("h-1.5 w-1.5 rounded-full", className)} aria-hidden />;
}
```

Notes: `gap-1` is harmless when `icon` is absent (single child). Passed `className` colors win via `twMerge`. `team/page.tsx`'s existing `<Badge className={roleTone}>` keeps working unchanged.

**Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (note - call sites still import the soon-deleted wrappers, which still exist at this point, so no new errors here).

**Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat: make Badge a single configurable pill + add Dot icon"
```

---

### Task 2: Add `dot` color to `HEALTH_META`

Moves the 8-states→5-colors dot mapping (currently in `HealthDot`) into lib data so the 2 health call sites don't each duplicate the switch.

**Files:**
- Modify: `src/lib/decision-health.ts:76` (the `HEALTH_META` type + 8 entries)

**Step 1: Add `dot` to the type and every entry**

Change the type from:
```ts
export const HEALTH_META: Record<DecisionHealth, { label: string; hint: string; tone: string }> = {
```
to:
```ts
export const HEALTH_META: Record<DecisionHealth, { label: string; hint: string; tone: string; dot: string }> = {
```

Add a `dot` field to each entry (values reproduce the old `HealthDot` mapping exactly):

| key | dot |
|---|---|
| `healthy` | `"bg-emerald-500"` |
| `review-due-soon` | `"bg-indigo-500"` |
| `review-overdue` | `"bg-amber-500"` |
| `stale` | `"bg-rose-500"` |
| `orphaned` | `"bg-slate-400"` |
| `superseded-unreviewed` | `"bg-rose-500"` |
| `superseded` | `"bg-slate-400"` |
| `archived` | `"bg-slate-400"` |

**Step 2: Typecheck + smoke**

Run: `npx tsc --noEmit && npm run test:smoke`
Expected: both PASS. The `decision-health` suite tests `computeDecisionHealth` states/precedence, not `HEALTH_META` shape, so it stays green. Confirm baseline first (next step).

**Step 3: Record baseline before trusting "green"**

Run `npm run test:smoke` once BEFORE Step 1 too, and note the pass/fail counts. After Step 1, counts must be identical.

**Step 4: Commit**

```bash
git add src/lib/decision-health.ts
git commit -m "feat: add dot color to HEALTH_META for inline health badges"
```

---

### Task 3: Migrate `team/page.tsx` (smoke test of the new API)

No badge wrapper here - it already uses `<Badge>` directly. This task only confirms the new `Badge` renders it unchanged. Likely zero code change.

**Files:**
- Verify: `src/app/(app)/team/page.tsx:115-124`

**Step 1:** Confirm `<Badge className={roleTone}>…</Badge>` still typechecks and renders. No edit expected.

**Step 2:** `npx tsc --noEmit` → PASS. No commit (no change).

---

### Task 4: Migrate `my-work/page.tsx`

**Files:**
- Modify: `src/app/(app)/my-work/page.tsx` (import line 7; usage line 236)

**Step 1: Swap import**

Remove:
```tsx
import { StatusBadge } from "@/components/decisions/status-badge";
```
Add (merge with existing imports):
```tsx
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, STATUSES, getLabelForValue } from "@/lib/utils";
```

**Step 2: Inline the usage**

Replace `<StatusBadge status={d.status} />` with:
```tsx
<Badge className={STATUS_COLORS[d.status] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(STATUSES, d.status)}
</Badge>
```

**Step 3:** `npx tsc --noEmit` → PASS.

**Step 4: Commit**

```bash
git add "src/app/(app)/my-work/page.tsx"
git commit -m "refactor: inline status badge in my-work page"
```

---

### Task 5: Migrate `decisions/decisions-table.tsx` (status, outcome, impact, category)

**Files:**
- Modify: `src/app/(app)/decisions/decisions-table.tsx` (imports lines 7-10; usages 125, 128, 134, 140)

**Step 1: Swap imports**

Remove the `StatusBadge, OutcomeBadge, ImpactBadge, CategoryBadge` import block. Add:
```tsx
import { Badge } from "@/components/ui/badge";
import {
  STATUS_COLORS, OUTCOME_COLORS, IMPACT_COLORS, CATEGORY_COLORS,
  STATUSES, OUTCOME_STATUSES, IMPACT_LEVELS, CATEGORIES,
  getLabelForValue,
} from "@/lib/utils";
```

**Step 2: Inline each usage**

```tsx
// line 125
<Badge className={CATEGORY_COLORS[d.category] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(CATEGORIES, d.category)}
</Badge>

// line 128
<Badge className={STATUS_COLORS[d.status] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(STATUSES, d.status)}
</Badge>

// line 134
<Badge className={IMPACT_COLORS[d.impactLevel] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(IMPACT_LEVELS, d.impactLevel)} Impact
</Badge>

// line 140 - outcome may be null → "unknown"
<Badge className={OUTCOME_COLORS[d.outcomeStatus ?? "unknown"] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(OUTCOME_STATUSES, d.outcomeStatus ?? "unknown")}
</Badge>
```

**Step 3:** `npx tsc --noEmit` → PASS.

**Step 4: Commit**

```bash
git add "src/app/(app)/decisions/decisions-table.tsx"
git commit -m "refactor: inline badges in decisions table"
```

---

### Task 6: Migrate `decisions/page.tsx` (status, health, outcome)

**Files:**
- Modify: `src/app/(app)/decisions/page.tsx` (imports 20-21; usages 518-530)

**Step 1: Swap imports**

Remove lines 20-21 (`OutcomeBadge, StatusBadge`, `HealthBadge`). Add:
```tsx
import { Badge, Dot } from "@/components/ui/badge";
import { computeDecisionHealth, HEALTH_META } from "@/lib/decision-health";
import {
  STATUS_COLORS, OUTCOME_COLORS, STATUSES, OUTCOME_STATUSES, getLabelForValue,
} from "@/lib/utils";
```

**Step 2: Compute health once in the map body**

The badges are inside a `.map((d) => …)`. Ensure the callback uses a block body and compute health once:
```tsx
.map((d) => {
  const h = computeDecisionHealth({
    status: d.status,
    ownerUserId: d.ownerUserId,
    reviewDate: d.reviewDate,
    reviewedAt: d.reviewedAt,
    updatedAt: d.updatedAt,
    reviewCount: d._count.reviews,
  });
  const m = HEALTH_META[h];
  return (
    …
  );
})
```

**Step 3: Inline the three badges** (replacing lines 518-530)

```tsx
<Badge className={STATUS_COLORS[d.status] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(STATUSES, d.status)}
</Badge>
<Badge size="xs" className={m.tone} title={m.hint} icon={<Dot className={m.dot} />}>
  {m.label}
</Badge>
{d.outcomeStatus !== "unknown" && (
  <Badge className={OUTCOME_COLORS[d.outcomeStatus] ?? "bg-slate-100 text-slate-600"}>
    {getLabelForValue(OUTCOME_STATUSES, d.outcomeStatus)}
  </Badge>
)}
```

**Step 4:** `npx tsc --noEmit` → PASS.

**Step 5: Commit**

```bash
git add "src/app/(app)/decisions/page.tsx"
git commit -m "refactor: inline status/health/outcome badges in decisions list"
```

---

### Task 7: Migrate `decisions/[id]/page.tsx` (status, health, blast, outcome ×2)

**Files:**
- Modify: `src/app/(app)/decisions/[id]/page.tsx` (imports 8-10; usages 167, 168-177, 178, 304, 323)

**Step 1: Swap imports**

Remove lines 8-10. Add:
```tsx
import { Badge, Dot } from "@/components/ui/badge";
import { Network } from "lucide-react";
import { computeDecisionHealth, HEALTH_META } from "@/lib/decision-health";
import {
  STATUS_COLORS, OUTCOME_COLORS, STATUSES, OUTCOME_STATUSES, getLabelForValue,
} from "@/lib/utils";
```
(If `Network` or these utils are already imported, merge - don't duplicate.)

**Step 2: Compute health near `blastRadius`**

Where `blastRadius` is computed in render, add:
```tsx
const health = computeDecisionHealth({
  status: decision.status,
  ownerUserId: decision.ownerUserId,
  reviewDate: decision.reviewDate,
  reviewedAt: decision.reviewedAt,
  updatedAt: decision.updatedAt,
  reviewCount: decision.reviews.length,
});
const healthMeta = HEALTH_META[health];
```

**Step 3: Inline the header badges** (lines 167-178)

```tsx
<Badge className={STATUS_COLORS[decision.status] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(STATUSES, decision.status)}
</Badge>
<Badge className={healthMeta.tone} title={healthMeta.hint} icon={<Dot className={healthMeta.dot} />}>
  {healthMeta.label}
</Badge>
{blastRadius > 0 && (
  <Badge
    href={`/decisions/${id}#relations`}
    title={blastRadius === 1 ? "1 decision depends on this" : `${blastRadius} decisions depend on this`}
    className={
      blastRadius >= 5
        ? "bg-rose-50 border-rose-200 text-rose-700"
        : blastRadius >= 2
        ? "bg-amber-50 border-amber-200 text-amber-700"
        : "bg-slate-50 border-slate-200 text-slate-600"
    }
    icon={<Network className="h-3 w-3" />}
  >
    Blast radius: {blastRadius}
  </Badge>
)}
```

**Step 4: Inline the two outcome badges** (lines 304, 323)

```tsx
<Badge className={OUTCOME_COLORS[latest.outcomeStatus ?? "unknown"] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(OUTCOME_STATUSES, latest.outcomeStatus ?? "unknown")}
</Badge>
```
```tsx
<Badge className={OUTCOME_COLORS[review.outcomeStatus ?? "unknown"] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(OUTCOME_STATUSES, review.outcomeStatus ?? "unknown")}
</Badge>
```

**Step 5:** `npx tsc --noEmit` → PASS.

**Step 6: Commit**

```bash
git add "src/app/(app)/decisions/[id]/page.tsx"
git commit -m "refactor: inline status/health/blast/outcome badges in decision detail"
```

---

### Task 8: Migrate `analytics/page.tsx` (status, category)

**Files:**
- Modify: `src/app/(app)/analytics/page.tsx` (import 6; usages 175, 192)

**Step 1: Swap import**

Remove line 6. Add:
```tsx
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, CATEGORY_COLORS, STATUSES, CATEGORIES, getLabelForValue } from "@/lib/utils";
```

**Step 2: Inline**

```tsx
// line 175
<Badge className={STATUS_COLORS[row.status] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(STATUSES, row.status)}
</Badge>
// line 192
<Badge className={CATEGORY_COLORS[row.category] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(CATEGORIES, row.category)}
</Badge>
```

**Step 3:** `npx tsc --noEmit` → PASS.

**Step 4: Commit**

```bash
git add "src/app/(app)/analytics/page.tsx"
git commit -m "refactor: inline status/category badges in analytics"
```

---

### Task 9: Migrate `reviews/page.tsx` (status ×2, outcome)

**Files:**
- Modify: `src/app/(app)/reviews/page.tsx` (import 6; usages 138, 177, 199)

**Step 1: Swap import**

Remove line 6. Add:
```tsx
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, OUTCOME_COLORS, STATUSES, OUTCOME_STATUSES, getLabelForValue } from "@/lib/utils";
```

**Step 2: Inline** (lines 138 and 177 identical pattern)

```tsx
<Badge className={STATUS_COLORS[d.status] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(STATUSES, d.status)}
</Badge>
```
```tsx
// line 199
<Badge className={OUTCOME_COLORS[review.outcomeStatus ?? "unknown"] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(OUTCOME_STATUSES, review.outcomeStatus ?? "unknown")}
</Badge>
```

**Step 3:** `npx tsc --noEmit` → PASS.

**Step 4: Commit**

```bash
git add "src/app/(app)/reviews/page.tsx"
git commit -m "refactor: inline status/outcome badges in reviews"
```

---

### Task 10: Migrate `share/[id]/page.tsx` (status, outcome ×2)

**Files:**
- Modify: `src/app/share/[id]/page.tsx` (import 4; usages 100, 101, 187)

**Step 1: Swap import**

Remove line 4. Add:
```tsx
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, OUTCOME_COLORS, STATUSES, OUTCOME_STATUSES, getLabelForValue } from "@/lib/utils";
```

**Step 2: Inline**

```tsx
// line 100
<Badge className={STATUS_COLORS[decision.status] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(STATUSES, decision.status)}
</Badge>
// line 101 - guarded by `decision.outcomeStatus &&`
{decision.outcomeStatus && (
  <Badge className={OUTCOME_COLORS[decision.outcomeStatus] ?? "bg-slate-100 text-slate-600"}>
    {getLabelForValue(OUTCOME_STATUSES, decision.outcomeStatus)}
  </Badge>
)}
// line 187
<Badge className={OUTCOME_COLORS[review.outcomeStatus ?? "unknown"] ?? "bg-slate-100 text-slate-600"}>
  {getLabelForValue(OUTCOME_STATUSES, review.outcomeStatus ?? "unknown")}
</Badge>
```

**Step 3:** `npx tsc --noEmit` → PASS.

**Step 4: Commit**

```bash
git add "src/app/share/[id]/page.tsx"
git commit -m "refactor: inline status/outcome badges in share page"
```

---

### Task 11: Delete the wrapper components

Only safe after Tasks 4-10 removed every import. Verify first.

**Files:**
- Delete: `src/components/decisions/status-badge.tsx`
- Delete: `src/components/decisions/health-badge.tsx`
- Delete: `src/components/decisions/blast-radius-badge.tsx`

**Step 1: Confirm no remaining importers**

Run:
```bash
grep -rn "status-badge\|health-badge\|blast-radius-badge\|StatusBadge\|OutcomeBadge\|ImpactBadge\|CategoryBadge\|HealthBadge\|BlastRadiusBadge" src --include="*.tsx" | grep -v "\.stories\.tsx"
```
Expected: no output. (Stories are handled in Task 12.)

**Step 2: Delete the files**

```bash
git rm src/components/decisions/status-badge.tsx src/components/decisions/health-badge.tsx src/components/decisions/blast-radius-badge.tsx
```

**Step 3:** `npx tsc --noEmit` → PASS.

**Step 4: Commit**

```bash
git commit -m "refactor: delete badge wrapper components, replaced by configurable Badge"
```

---

### Task 12: Consolidate Storybook into one story file

**Files:**
- Delete: `src/components/decisions/status-badge.stories.tsx`
- Delete: `src/components/decisions/health-badge.stories.tsx`
- Delete: `src/components/decisions/blast-radius-badge.stories.tsx`
- Modify: `src/components/ui/badge.stories.tsx` (replace with all configurations)

**Step 1: Delete the dead stories**

```bash
git rm src/components/decisions/status-badge.stories.tsx src/components/decisions/health-badge.stories.tsx src/components/decisions/blast-radius-badge.stories.tsx
```

**Step 2: Write the consolidated story**

Replace `src/components/ui/badge.stories.tsx` with:

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Network } from "lucide-react";
import { Badge, Dot } from "./badge";
import {
  STATUS_COLORS, OUTCOME_COLORS, IMPACT_COLORS, CATEGORY_COLORS,
  STATUSES, OUTCOME_STATUSES, IMPACT_LEVELS, CATEGORIES, getLabelForValue,
} from "@/lib/utils";
import { HEALTH_META } from "@/lib/decision-health";

const meta = {
  title: "UI/Badge",
  component: Badge,
  args: { children: "Badge" },
  argTypes: {
    variant: { control: "inline-radio", options: ["default", "outline"] },
    size: { control: "inline-radio", options: ["xs", "sm"] },
    href: { control: "text" },
    title: { control: "text" },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2">{children}</div>
);

// --- Primitives / configuration knobs ---
export const Playground: Story = { args: { variant: "default" } };

export const Variants: Story = {
  render: () => (
    <Row>
      <Badge variant="default">Default</Badge>
      <Badge variant="outline">Outline</Badge>
    </Row>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Row>
      <Badge size="xs">xs</Badge>
      <Badge size="sm">sm</Badge>
    </Row>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <Row>
      <Badge icon={<Network className="h-3 w-3" />}>Lucide icon</Badge>
      <Badge icon={<Dot className="bg-emerald-500" />}>Dot icon</Badge>
    </Row>
  ),
};

export const AsLink: Story = {
  render: () => (
    <Badge href="#relations" icon={<Network className="h-3 w-3" />}>
      Links somewhere
    </Badge>
  ),
};

// --- Real use cases (configured inline, exactly like the product) ---
export const StatusUseCase: Story = {
  render: () => (
    <Row>
      {STATUSES.map((s) => (
        <Badge key={s.value} className={STATUS_COLORS[s.value]}>
          {getLabelForValue(STATUSES, s.value)}
        </Badge>
      ))}
    </Row>
  ),
};

export const OutcomeUseCase: Story = {
  render: () => (
    <Row>
      {OUTCOME_STATUSES.map((o) => (
        <Badge key={o.value} className={OUTCOME_COLORS[o.value]}>
          {getLabelForValue(OUTCOME_STATUSES, o.value)}
        </Badge>
      ))}
    </Row>
  ),
};

export const ImpactUseCase: Story = {
  render: () => (
    <Row>
      {IMPACT_LEVELS.map((i) => (
        <Badge key={i.value} className={IMPACT_COLORS[i.value]}>
          {getLabelForValue(IMPACT_LEVELS, i.value)} Impact
        </Badge>
      ))}
    </Row>
  ),
};

export const CategoryUseCase: Story = {
  render: () => (
    <Row>
      {CATEGORIES.map((c) => (
        <Badge key={c.value} className={CATEGORY_COLORS[c.value]}>
          {getLabelForValue(CATEGORIES, c.value)}
        </Badge>
      ))}
    </Row>
  ),
};

export const HealthUseCase: Story = {
  render: () => (
    <Row>
      {Object.entries(HEALTH_META).map(([key, m]) => (
        <Badge key={key} className={m.tone} title={m.hint} icon={<Dot className={m.dot} />}>
          {m.label}
        </Badge>
      ))}
    </Row>
  ),
};

export const BlastRadiusUseCase: Story = {
  render: () => {
    const tone = (n: number) =>
      n >= 5
        ? "bg-rose-50 border-rose-200 text-rose-700"
        : n >= 2
        ? "bg-amber-50 border-amber-200 text-amber-700"
        : "bg-slate-50 border-slate-200 text-slate-600";
    return (
      <Row>
        {[1, 3, 7].map((n) => (
          <Badge key={n} href="#relations" className={tone(n)} icon={<Network className="h-3 w-3" />}>
            Blast radius: {n}
          </Badge>
        ))}
      </Row>
    );
  },
};
```

**Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (If Storybook story files are excluded from the app tsconfig, also rely on the Storybook build check in Task 13.)

**Step 4: Commit**

```bash
git add src/components/ui/badge.stories.tsx
git commit -m "docs(storybook): consolidate badge stories with all configurations"
```

---

### Task 13: Full gate + run Storybook for review

**Step 1: Run the full gate**

```bash
npx tsc --noEmit && npm run lint && npm run test:smoke
```
Expected: all PASS. Compare `test:smoke` counts to the Task 2 baseline - must be identical.

**Step 2: Verify nothing still references the deleted components**

```bash
grep -rn "status-badge\|health-badge\|blast-radius-badge" src
```
Expected: no output.

**Step 3: Launch Storybook (background) for the user to check**

```bash
npm run storybook
```
Runs at http://localhost:6006 → **UI/Badge**. Tell the user to review: Variants, Sizes, WithIcon, AsLink, and the use-case stories (Status, Outcome, Impact, Category, Health, BlastRadius). Confirm the accepted visual convergence looks right.

**Step 4:** Do NOT commit anything further until the user confirms the visuals. This is the user-verification checkpoint.

---

## Risk to watch (most-likely-wrong claim)

That every migrated call site reproduces its old wrapper's exact output - fallback colors (`?? "bg-slate-100 text-slate-600"`), the `… Impact` suffix on impact, outcome's null→`"unknown"` coalescing, blast's null-at-0 guard and singular/plural title, and the health dot color per state. Diff each inline block against the deleted wrapper before declaring done. The visual base-style convergence (font weight/padding) is intended, not a regression - confirm in Storybook.
