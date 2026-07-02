# Table Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reusable, composed `Table` primitive to `src/components/ui/` - a real `<table>` built from `Table.Head` / `Table.Body` / `Table.Row` / `Table.Cell`, where a `Cell` renders `<th>` inside the head and `<td>` inside the body.

**Architecture:** One file, compound API hung off `Table`. A React context (`{ header: boolean }`) provided by `Table.Head`/`Table.Body` lets `Table.Cell` pick its tag and lets `Table.Row` enable hover/selection only in the body. Because it reads context, the file is `"use client"`. The primitive is presentational only - no selection, sorting, pagination, or data/columns config (those stay at the call site, as `decisions-table` already does).

**Tech Stack:** Next.js 16 (React 19), Tailwind, existing `Text` primitive (`@/components/ui/text`), `cn` (`@/lib/utils`).

---

## Notes for the implementer

- **No smoke test.** Smoke tests (`tests/smoke/`) cover pure-function `src/lib` logic. This is presentational with no branching logic worth unit-testing. Verification = `npx tsc --noEmit`, `npm run lint`, and the Storybook story renders. Run `npm run test:smoke` only to confirm you broke nothing (it won't exercise this file).
- **Styling matches today's `decisions-table.tsx` exactly** so adopting the primitive later is a no-visual-change refactor. Do not redesign the look here.
- **Header label type is owned in one place** - the `<Text>` inside the header branch of `Table.Cell`. Today it uses `Text` defaults (matches current headers). Tune there if the look ever changes; never set header type at a call site.
- Do **not** add `decisions-table` migration to this plan. Shipping the primitive + story is the whole scope. Migrating the existing table is a separate follow-up.

---

### Task 1: Create the Table primitive

**Files:**
- Create: `src/components/ui/table.tsx`

**Step 1: Write the component**

Create `src/components/ui/table.tsx` with exactly this content:

```tsx
"use client";

import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";

// Which section a cell lives in. Head cells render <th>; body cells render <td>.
// Provided by Table.Head / Table.Body, read by Table.Cell and Table.Row.
const TableSection = createContext<{ header: boolean }>({ header: false });

export function Table({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full", className)}>{children}</table>
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <TableSection.Provider value={{ header: true }}>
      <thead className="border-b border-slate-200 bg-slate-50">{children}</thead>
    </TableSection.Provider>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <TableSection.Provider value={{ header: false }}>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </TableSection.Provider>
  );
}

function TableRow({
  children,
  onClick,
  selected = false,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}) {
  const { header } = useContext(TableSection);
  const interactive = !header && !!onClick;
  return (
    <tr
      onClick={header ? undefined : onClick}
      className={cn(
        !header && "group transition-colors hover:bg-slate-50",
        !header && selected && "bg-blue-50",
        interactive && "cursor-pointer",
        className,
      )}
    >
      {children}
    </tr>
  );
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" };

function Cell({
  children,
  align = "left",
  colSpan,
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  colSpan?: number;
  className?: string;
}) {
  const { header } = useContext(TableSection);
  const cls = cn("px-4 py-3", alignClass[align], className);
  if (header) {
    return (
      <th colSpan={colSpan} className={cls}>
        <Text>{children}</Text>
      </th>
    );
  }
  return (
    <td colSpan={colSpan} className={cls}>
      {children}
    </td>
  );
}

Table.Head = Head;
Table.Body = Body;
Table.Row = TableRow;
Table.Cell = Cell;
```

**Step 2: Verify types and lint pass**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass, no errors referencing `table.tsx`.

**Step 3: Commit**

```bash
git add src/components/ui/table.tsx
git commit -m "feat(ui): add composed Table primitive"
```

---

### Task 2: Add the Storybook story

**Files:**
- Create: `src/components/ui/table.stories.tsx`

**Step 1: Write the story**

Create `src/components/ui/table.stories.tsx`. It must exercise: header row, multiple body rows, a `Badge` cell, a right-aligned cell, a `hidden md:table-cell` responsive column, and a selected row.

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Badge } from "@/components/ui/badge";
import { Table } from "./table";

const meta = {
  title: "UI/Table",
  component: Table,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
  { id: "1", title: "Adopt Postgres", status: "Decided", owner: "Alice", score: 92 },
  { id: "2", title: "Drop legacy API", status: "Proposed", owner: "Bob", score: 71 },
  { id: "3", title: "Rename workspace", status: "Blocked", owner: "Carol", score: 48 },
];

export const Default: Story = {
  render: () => (
    <Table>
      <Table.Head>
        <Table.Row>
          <Table.Cell>Title</Table.Cell>
          <Table.Cell>Status</Table.Cell>
          <Table.Cell className="hidden md:table-cell">Owner</Table.Cell>
          <Table.Cell align="right">Score</Table.Cell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map((r, i) => (
          <Table.Row key={r.id} selected={i === 0} onClick={() => {}}>
            <Table.Cell>{r.title}</Table.Cell>
            <Table.Cell>
              <Badge>{r.status}</Badge>
            </Table.Cell>
            <Table.Cell className="hidden md:table-cell">{r.owner}</Table.Cell>
            <Table.Cell align="right">{r.score}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

// Empty body via a colSpan cell - the call-site empty-row pattern.
export const EmptyRow: Story = {
  render: () => (
    <Table>
      <Table.Head>
        <Table.Row>
          <Table.Cell>Title</Table.Cell>
          <Table.Cell>Status</Table.Cell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          <Table.Cell colSpan={2} align="center">
            No decisions yet.
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};
```

> **Check before writing:** confirm `Badge` accepts plain string children with no required props (open `src/components/ui/badge.tsx`). If it requires a color/variant prop, pass the simplest valid one - do not change `Badge`.

**Step 2: Verify types and lint pass**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

**Step 3: Visual check (manual)**

Render the story in Storybook (use the project's storybook script - check `package.json`). Confirm:
- Header cells are bold/header-styled `<th>`; columns line up with body.
- First body row is highlighted (`bg-blue-50`); hover highlights others.
- "Owner" column hides below the `md` breakpoint.
- "Score" is right-aligned in both header and body.
- `EmptyRow` story spans both columns, centered.

**Step 4: Confirm nothing else broke**

Run: `npm run test:smoke`
Expected: same pass count as before this plan (baseline: capture it first with a clean `git stash` if unsure).

**Step 5: Commit**

```bash
git add src/components/ui/table.stories.tsx
git commit -m "docs(ui): add Table story"
```

---

## Out of scope (YAGNI - add when a real second table needs it)

- Migrating `decisions-table.tsx` to the primitive.
- Sorting, sticky header, column resize, pagination.
- Built-in row selection / checkbox column (call-site concern).
- A data/`columns` config API (you chose composed cells).
- Deduping the `hidden md:table-cell` class across head+body cells (composed API can't; acceptable, same as today).
