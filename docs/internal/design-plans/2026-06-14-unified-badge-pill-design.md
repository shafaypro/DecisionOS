# Unified Badge Pill - Design

**Date:** 2026-06-14
**Status:** Validated, ready for implementation

## Goal

Collapse all pill-shaped badges into **one dumb, fully-configurable component**.
The programmer eyeballs a spot, decides it fits, and sets colors + icon as
attributes. No `useCase` prop, no registry, no preset wrappers - use-case
knowledge lives in the programmer's head, expressed inline at the call site.

## What's being replaced

| File | Components | Fate |
|------|-----------|------|
| `src/components/ui/badge.tsx` | `Badge` | **Enhanced** (becomes the one pill) |
| `src/components/decisions/status-badge.tsx` | `StatusBadge`, `OutcomeBadge`, `ImpactBadge`, `CategoryBadge` | **Deleted** |
| `src/components/decisions/health-badge.tsx` | `HealthBadge` | **Deleted** |
| `src/components/decisions/blast-radius-badge.tsx` | `BlastRadiusBadge` | **Deleted** |

~35 call sites across 8 files:
`my-work`, `decisions/decisions-table`, `decisions/page`, `reviews`,
`decisions/[id]/page`, `analytics`, `share/[id]/page`, `team/page`.

## The one component

Enhance `Badge` with three optional attributes. Everything stays
programmer-configured; nothing is branched by use case.

```tsx
Badge({
  children,            // label - programmer writes it
  className,           // colors - e.g. "bg-rose-50 text-rose-700 border-rose-200"
  icon,                // any node. A <Dot/> is an icon. A <Network/> is an icon.
  size = "sm",         // "xs" | "sm"
  href,                // set -> renders <Link>, else <span>
  title,               // tooltip
})
```

- `icon` renders in a leading slot with `gap-1` when present.
- `href` switches the wrapper element from `<span>` to `next/link` `<Link>`.
- `size` maps to padding/text: `xs` -> `px-1.5 py-0.5 text-[10px]`,
  `sm` -> `px-2 py-0.5 text-xs`. (Preserves current health/blast sizing.)
- Existing `variant` prop: keep as-is.

## Icons componentized

"Dot is an icon too." Add one tiny presentational component so a dot is a
passable node like any lucide icon:

```tsx
// colored circle indicator
export function Dot({ className }: { className?: string }) {
  return <span className={cn("h-1.5 w-1.5 rounded-full", className)} aria-hidden />;
}
```

Location: `src/components/ui/badge.tsx` (co-located) or `src/components/ui/dot.tsx`.
Lucide icons (`Network`, etc.) are passed the same way - no wrapper needed.

## Call-site patterns (inline, pure)

```tsx
// status / outcome / impact / category - read existing maps from @/lib/utils
<Badge className={STATUS_COLORS[s]}>{getLabelForValue(STATUSES, s)}</Badge>
<Badge className={IMPACT_COLORS[i]}>{getLabelForValue(IMPACT_LEVELS, i)} Impact</Badge>

// health - programmer calls computeDecisionHealth, reads HEALTH_META
const h = computeDecisionHealth(decision);
const m = HEALTH_META[h];
<Badge className={m.tone} title={m.hint} icon={<Dot className={dotToneFor(h)} />}>
  {m.label}
</Badge>

// blast radius - programmer handles null-at-0 + link inline
{count > 0 && (
  <Badge
    href={`/decisions/${id}#relations`}
    title={`${count} decisions depend on this`}
    className={blastTone(count)}
    icon={<Network className="h-3 w-3" />}
  >
    Blast radius: {count}
  </Badge>
)}
```

The health dot-tone and blast threshold-tone are small local expressions the
programmer writes inline (or a 3-line local helper in the page) - they are
**not** part of the component.

## Non-goals (YAGNI)

- No `useCase` prop / internal branching.
- No registry or config-object abstraction.
- No preset wrapper components.
- No `tone` shorthand - colors go through `className`.

## Verification

- `npx tsc --noEmit` - must pass.
- `npm run lint` - must pass.
- `npm run test:smoke` - must pass (no lib logic changes expected).
- Storybook: update/replace stories for the deleted components with stories
  for the single `Badge` (configured variants: status, health, blast, etc.).
- Visual spot-check: decisions list, decision detail header, dashboard,
  analytics, share page render identically to before.

## Risk to watch

Deleting the wrappers spreads map-lookup + compute + null logic across ~35
call sites. The one claim most likely to be wrong: that every old wrapper's
visual output (padding, dot color, tooltip text, link target) is reproduced
exactly inline. Diff each migrated call site against the original wrapper.
