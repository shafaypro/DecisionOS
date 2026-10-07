"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { sendJson } from "@/lib/client-fetch";
import { ACTION_ITEM_PRIORITIES, cn, formatDate } from "@/lib/utils";

export interface DecisionActionItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
}

/**
 * The follow-through on a decision: its action items, checkable in place, plus
 * a one-line add form. The full board at /board shows the same items.
 */
export function ActionItems({
  decisionId,
  items: initialItems,
  members,
  readOnly,
}: {
  decisionId: string;
  items: DecisionActionItem[];
  members: { id: string; name: string }[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(initialItems);
  const [prev, setPrev] = useState(initialItems);
  if (initialItems !== prev) {
    setPrev(initialItems);
    setItems(initialItems);
  }
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();

  const open = items.filter((i) => i.status !== "done" && i.status !== "cancelled");
  const done = items.filter((i) => i.status === "done");
  const today = new Date().toISOString().slice(0, 10);

  function toggleDone(item: DecisionActionItem) {
    const next = item.status === "done" ? "open" : "done";
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, status: next } : i)));
    startTransition(async () => {
      const err = await sendJson(`/api/action-items/${item.id}`, "PATCH", { status: next });
      if (err) {
        setItems((all) => all.map((i) => (i.id === item.id ? item : i)));
        toast.error(`Could not update: ${err}`);
      } else router.refresh();
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const err = await sendJson("/api/action-items", "POST", {
        title: title.trim(),
        decisionId,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
      });
      if (err) {
        toast.error(`Could not add: ${err}`);
        return;
      }
      setTitle("");
      setAssigneeId("");
      setDueDate("");
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !adding && (
        <Text as="p" size="sm" color="subtle">
          No follow-ups yet. Add the work this decision commits the team to.
        </Text>
      )}

      {[...open, ...done].length > 0 && (
        <ul className="space-y-1.5">
          {[...open, ...done].map((item) => {
            const isDone = item.status === "done";
            const overdue = !isDone && item.dueDate && item.dueDate.slice(0, 10) < today;
            const priority = ACTION_ITEM_PRIORITIES.find((p) => p.value === item.priority);
            return (
              <li key={item.id} className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={isDone}
                  disabled={readOnly || pending}
                  onChange={() => toggleDone(item)}
                  aria-label={`Mark "${item.title}" ${isDone ? "not done" : "done"}`}
                  className="mt-1 rounded-xs border-slate-300"
                />
                <div className="min-w-0 flex-1">
                  <Text as="p" className={cn(isDone && "text-text-subtle line-through")}>
                    {priority && !isDone && (
                      <span
                        className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle", priority.dot)}
                        title={`${priority.label} priority`}
                      />
                    )}
                    {item.title}
                  </Text>
                  <Text as="p" size="xs" color={overdue ? "danger" : "subtle"}>
                    {[
                      item.assignee?.name ?? "Unassigned",
                      item.dueDate ? `${overdue ? "Overdue · " : "Due "}${formatDate(item.dueDate)}` : null,
                      item.status === "in_progress" ? "In progress" : item.status === "in_review" ? "In review" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly &&
        (adding ? (
          <form onSubmit={add} className="space-y-2 rounded-xs bg-slate-50 p-3">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="What needs to happen?"
              aria-label="Action item"
              className="h-9 w-full rounded-xs bg-white px-3 text-sm shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                aria-label="Assignee"
                className="h-8 rounded-xs bg-white px-2 text-xs shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-text-subtle" aria-hidden />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-label="Due date"
                  className="h-8 rounded-xs bg-white px-2 text-xs shadow-soft focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <div className="ml-auto flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={pending || !title.trim()}>Add</Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => setAdding(true)} icon={<Plus className="h-3.5 w-3.5" />}>
              Add action item
            </Button>
            {items.length > 0 && (
              <Link href="/board" className="hover:underline">
                <Text size="xs" color="muted">Open the board →</Text>
              </Link>
            )}
          </div>
        ))}
    </div>
  );
}
