# ListRow - flexible list element (design, to build later)

Status: spec only. Ported from starquix's `common/Row.tsx`, adapted to DecisionOS conventions (lowercase file, `cn`, named export, concrete Tailwind colors).

## What it is

One row in a list: leading slot, text + subtext, right text, right slot. Every slot is optional and independently toggleable. The leading/right slots take any `ReactNode`, so a **checkbox or radio is just passed in** - no variant prop, no new API. That's the whole flexibility story.

## API

```ts
interface ListRowProps {
  title: string;
  subtitle?: string;            // "caption" in starquix
  rightText?: string;
  leading?: React.ReactNode;    // icon | <input type="checkbox"> | <input type="radio"> | avatar | nothing
  trailing?: React.ReactNode;   // right icons / actions
  selected?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
  className?: string;
}
```

Dropped from the starquix original: `expandable` / `defaultExpanded` / `expanded` / `onExpandChange` / `children`. DecisionOS has no tree-list need yet - YAGNI. If a nested/expandable variant is needed later, add `expandable?: boolean` + `children` then, copying starquix lines 41-57 & 122-127.

## Behavior

- Layout: `flex items-center gap-2`, leading + trailing `shrink-0`, middle `flex-1 min-w-0` with `truncate` on both lines.
- Heights (match starquix): `md` → `h-14` with subtitle else `h-10`; `sm` → `h-12` with subtitle else `h-8`.
- `onClick` makes the whole row interactive: `cursor-pointer group hover:bg-gray-50`.
- `trailing` wrapper calls `e.stopPropagation()` so action clicks don't fire the row's `onClick` (starquix line 116). The leading slot does **not** stop propagation - a row click should toggle the checkbox/radio inside it, which is the point.
- `selected` → highlighted bg; `disabled` → `opacity-50 pointer-events-none`.

## Checkbox / radio usage (no special support needed)

```tsx
// checkbox - consumer owns state, row click toggles it
<ListRow
  leading={<input type="checkbox" checked={sel} onChange={e => setSel(e.target.checked)} />}
  title="Acme Corp" subtitle="3 decisions" rightText="2d ago"
  onClick={() => setSel(!sel)}
/>

// radio group - same name across rows
{options.map(o => (
  <ListRow key={o.id}
    leading={<input type="radio" name="owner" value={o.id} checked={pick === o.id} onChange={() => setPick(o.id)} />}
    title={o.name}
    onClick={() => setPick(o.id)}
  />
))}

// plain icon - toggle on/off by passing it or not
<ListRow leading={showIcon ? <FileIcon className="w-4 h-4" /> : null} title="Plan.pdf" />
```

## Grouping (radio group, dropdown) - later

For now, **no group component**. A radio group is the consumer mapping over `ListRow`:

```tsx
{options.map(o => (
  <ListRow key={o.id}
    leading={<input type="radio" name="owner" value={o.id}
                    checked={pick === o.id} onChange={() => setPick(o.id)} />}
    title={o.name}
    onClick={() => setPick(o.id)} />
))}
```

Componentize **only when a second use case appears** (e.g. a dropdown menu of `ListRow`s). At that point extract a `ListRowGroup` that owns selection: `value`, `onChange`, `items[]`, `mode: 'single' | 'multi'` (single ⇒ radio semantics, multi ⇒ checkbox). Don't build it before then - one for-loop isn't a component.

- add when: ≥2 call sites need the same select-one / select-many wiring (radio group **and** dropdown).

## ponytail notes

- skipped: `leading?: 'icon'|'checkbox'|'radio'` variant + built-in checked state. The `ReactNode` slot already does this. add when: 3+ call sites duplicate the same onChange/onClick wiring and want it owned by the row.
- skipped: `ListRowGroup` wrapper (see Grouping above). The for-loop covers the single radio-group case today.
- skipped: expandable/tree mode. add when: an actual nested list appears (copy from starquix Row).
- skipped: a test. It's a presentational layout component; the only logic worth a test (propagation, height selection) is trivial - add a smoke test if `size`/subtitle height math grows.

## Storybook (configurable from the controls panel)

Convention (from `badge.stories.tsx`): `@storybook/nextjs`, `Meta`/`StoryObj`, `args` + `argTypes`. String/bool/number props (`title`, `subtitle`, `rightText`, `selected`, `disabled`, `size`) become live controls automatically.

The catch: `leading`/`trailing` are `ReactNode`, which Storybook can't render as a control. To make those configurable, expose **string proxy args** and map them to nodes in `render` - don't put ReactNode on the public component just for Storybook.

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { ListRow } from "./list-row";

// proxy args drive the uncontrollable ReactNode slots
type Args = React.ComponentProps<typeof ListRow> & {
  leadingKind?: "none" | "icon" | "checkbox" | "radio";
  trailingKind?: "none" | "icon";
};

const leadingFor = (k: Args["leadingKind"]) => ({
  none: null,
  icon: <FileIcon className="w-4 h-4" />,
  checkbox: <input type="checkbox" defaultChecked />,
  radio: <input type="radio" name="demo" defaultChecked />,
}[k ?? "none"]);

const meta = {
  title: "UI/ListRow",
  component: ListRow,
  args: { title: "Acme Corp", subtitle: "3 decisions", rightText: "2d ago",
          size: "sm", leadingKind: "icon", trailingKind: "none" },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md"] },
    leadingKind: { control: "inline-radio", options: ["none", "icon", "checkbox", "radio"] },
    trailingKind: { control: "inline-radio", options: ["none", "icon"] },
    selected: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  render: ({ leadingKind, trailingKind, ...args }: Args) => (
    <ListRow {...args}
      leading={leadingFor(leadingKind)}
      trailing={trailingKind === "icon" ? <MoreIcon className="w-4 h-4" /> : null} />
  ),
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<typeof meta>;

// Playground = the fully configurable one (all controls live)
export const Playground: Story = {};

// fixed showcases that the controls can't express well
export const RadioGroup: Story = {
  render: () => { /* 3 ListRows sharing name="owner" */ },
};
```

- `Playground` is the "truly flexible" story: every prop adjustable from the panel, leading slot switchable between none/icon/checkbox/radio.
- `RadioGroup` stays a hand-written `render` - for now a radio group is just the **consumer mapping over `ListRow`** with a shared `name`, no wrapper component. The story shows that pattern; it's not a new component yet.
- ponytail: skipped per-permutation static stories (Selected, Disabled, etc.) - the Playground covers them via controls. add a static story only when a specific combo needs to be pinned for visual review.

## Build checklist (later)

1. `src/components/ui/list-row.tsx` - named `export function ListRow`, `cn` from `@/lib/utils`.
2. `src/components/ui/list-row.stories.tsx` - `Playground` (proxy-arg controls, above) + `RadioGroup`.
3. `npx tsc --noEmit && npm run lint`.
