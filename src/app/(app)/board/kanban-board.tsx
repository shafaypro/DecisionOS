"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Text } from "@/components/ui/text";
import {
  Plus, AlertCircle, Calendar, User as UserIcon,
  ChevronRight, Trash2, Circle,
} from "lucide-react";
import { ACTION_ITEM_STATUSES, ACTION_ITEM_PRIORITIES, formatDate, getLabelForValue } from "@/lib/utils";

interface Member { id: string; name: string }
interface ActionItemDecision { id: string; title: string }
interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  decisionId: string | null;
  assignee: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  decision: ActionItemDecision | null;
}

interface KanbanBoardProps {
  initialItems: ActionItem[];
  members: Member[];
  decisions: ActionItemDecision[];
  currentUserId: string;
  isViewer: boolean;
}

const COLUMNS = ACTION_ITEM_STATUSES.filter((s) => s.value !== "cancelled");

const PRIORITY_DOT: Record<string, string> = {
  low:      "bg-slate-400",
  medium:   "bg-amber-400",
  high:     "bg-orange-500",
  critical: "bg-red-500",
};

function PriorityDot({ priority }: { priority: string }) {
  return (
    <div
      className={`mt-1 inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[priority] ?? "bg-slate-400"}`}
      title={getLabelForValue(ACTION_ITEM_PRIORITIES, priority)}
    />
  );
}

function ItemCard({
  item,
  onStatusChange,
  onDelete,
  isViewer,
  currentUserId,
}: {
  item: ActionItem;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  isViewer: boolean;
  currentUserId: string;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isOverdue =
    item.dueDate && new Date(item.dueDate) < new Date() && item.status !== "done" && item.status !== "cancelled";

  return (
    <div className="bg-white rounded-xs p-3 shadow-soft transition-shadow group">
      <div className="flex items-start gap-2 mb-2">
        <PriorityDot priority={item.priority} />
        <Text as="p">
          {item.title}
        </Text>
        {!isViewer && (
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 flex-shrink-0 -mt-0.5"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showMenu && !isViewer && (
        <div className="mb-2 border border-slate-100 rounded-xs bg-slate-50 p-2 space-y-1">
          <Text as="p">Move to…</Text>
          {COLUMNS.map((col) =>
            col.value !== item.status ? (
              <button
                key={col.value}
                onClick={() => { onStatusChange(item.id, col.value); setShowMenu(false); }}
                className="w-full text-left py-1 px-2 rounded-xs hover:bg-white text-text-secondary hover:text-text-brand"
              >
                <Text>
                  {col.label}
                </Text>
              </button>
            ) : null
          )}
          {(item.createdBy.id === currentUserId) && (
            <>
              <div className="border-t border-slate-200 my-1" />
              <button
                onClick={() => { onDelete(item.id); setShowMenu(false); }}
                className="w-full text-left py-1 px-2 rounded-xs hover:bg-red-50 flex items-center gap-1.5"
              >
                <Trash2 className="h-3 w-3 text-text-danger" />
                <Text>Delete</Text>
              </button>
            </>
          )}
        </div>
      )}

      {item.description && (
        <Text as="p">{item.description}</Text>
      )}

      {item.decision && (
        <Link href={`/decisions/${item.decision.id}`} className="hover:underline block mb-2">
          <Text>
            ↳ {item.decision.title}
          </Text>
        </Link>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {item.assignee && (
          <span className="flex items-center gap-1">
            <UserIcon className="h-3 w-3" />
            <Text>
              {item.assignee.name}
            </Text>
          </span>
        )}
        {item.dueDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <Text>
              {isOverdue ? "Overdue · " : ""}{formatDate(item.dueDate)}
            </Text>
          </span>
        )}
      </div>
    </div>
  );
}

function CreateItemForm({
  status,
  members,
  decisions,
  onCreated,
  onCancel,
}: {
  status: string;
  members: Member[];
  decisions: ActionItemDecision[];
  onCreated: (item: ActionItem) => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [decisionId, setDecisionId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string>();

  function submit() {
    if (!title.trim()) return;
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, assigneeId: assigneeId || null, priority, decisionId: decisionId || null, dueDate: dueDate || null }),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      // Patch status if not "open"
      if (status !== "open") {
        const r2 = await fetch(`/api/action-items/${json.item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const j2 = await r2.json();
        onCreated(j2.item);
      } else {
        onCreated(json.item);
      }
    });
  }

  return (
    <div className="bg-white rounded-xs border border-blue-300 p-3 shadow-soft space-y-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Action item title…"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
      />
      <div className="grid grid-cols-2 gap-2">
        <NativeSelect
          label="Assignee"
          fieldClassName="space-y-0"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="h-8 px-2"
        >
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </NativeSelect>
        <NativeSelect
          label="Priority"
          fieldClassName="space-y-0"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-8 px-2"
        >
          {ACTION_ITEM_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </NativeSelect>
        <Input
          label="Due date"
          fieldClassName="space-y-0"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-8"
        />
        <NativeSelect
          label="Decision"
          fieldClassName="space-y-0"
          value={decisionId}
          onChange={(e) => setDecisionId(e.target.value)}
          className="h-8 px-2"
        >
          <option value="">None</option>
          {decisions.slice(0, 30).map((d) => <option key={d.id} value={d.id}>{d.title.slice(0, 40)}</option>)}
        </NativeSelect>
      </div>
      {error && (
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-text-danger" />
          <Text>{error}</Text>
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !title.trim()} onClick={submit} className="h-7">Add</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7">Cancel</Button>
      </div>
    </div>
  );
}

export function KanbanBoard({ initialItems, members, decisions, currentUserId, isViewer }: KanbanBoardProps) {
  const [items, setItems] = useState(initialItems);
  const [creating, setCreating] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function changeStatus(id: string, newStatus: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: newStatus } : i));
    startTransition(async () => {
      await fetch(`/api/action-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    });
  }

  function deleteItem(id: string) {
    if (!confirm("Delete this action item?")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      await fetch(`/api/action-items/${id}`, { method: "DELETE" });
    });
  }

  function addItem(item: ActionItem) {
    setItems((prev) => [...prev, item]);
    setCreating(null);
  }

  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 min-h-[70vh] sm:snap-none">
      {COLUMNS.map((col) => {
        const colItems = items.filter((i) => i.status === col.value);
        return (
          <div key={col.value} className="w-[82vw] max-w-[20rem] flex-shrink-0 snap-start sm:w-72">
            {/* Column header */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-t-xs border border-b-0 ${col.color}`}>
              <div className="flex items-center gap-2">
                <Circle className="h-3 w-3 fill-current opacity-60" />
                <Text as="span">
                  {col.label}
                </Text>
                <Text as="span">
                  {colItems.length}
                </Text>
              </div>
              {!isViewer && (
                <button
                  onClick={() => setCreating(col.value)}
                  className="opacity-60 hover:opacity-100"
                  title="Add item"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Column body */}
            <div className="bg-slate-50 rounded-b-xs border-t-0 p-2 space-y-2 min-h-32">
              {creating === col.value && (
                <CreateItemForm
                  status={col.value}
                  members={members}
                  decisions={decisions}
                  onCreated={addItem}
                  onCancel={() => setCreating(null)}
                />
              )}
              {colItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onStatusChange={changeStatus}
                  onDelete={deleteItem}
                  isViewer={isViewer}
                  currentUserId={currentUserId}
                />
              ))}
              {colItems.length === 0 && creating !== col.value && (
                <Text as="p">No items</Text>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
