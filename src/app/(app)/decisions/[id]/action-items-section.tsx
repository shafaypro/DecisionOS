"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Plus, X, AlertCircle, Calendar, User as UserIcon,
  ChevronDown, Trash2, CheckCircle2, Circle,
} from "lucide-react";
import {
  ACTION_ITEM_STATUSES,
  ACTION_ITEM_PRIORITIES,
  formatDate,
  getLabelForValue,
} from "@/lib/utils";
import { Text } from "@/components/ui/text";

interface Member { id: string; name: string }
interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
}

interface Props {
  decisionId: string;
  initialItems: ActionItem[];
  members: Member[];
  currentUserId: string;
  isViewer: boolean;
  isAdmin: boolean;
}

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-amber-400",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  open:        <Circle className="h-3.5 w-3.5 text-slate-400" />,
  in_progress: <Circle className="h-3.5 w-3.5 text-blue-500 fill-blue-100" />,
  in_review:   <Circle className="h-3.5 w-3.5 text-amber-500 fill-amber-100" />,
  done:        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  cancelled:   <X className="h-3.5 w-3.5 text-slate-300" />,
};

function AddItemForm({
  decisionId,
  members,
  onCreated,
  onCancel,
}: {
  decisionId: string;
  members: Member[];
  onCreated: (item: ActionItem) => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();

  function submit() {
    if (!title.trim()) return;
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          decisionId,
          assigneeId: assigneeId || null,
          priority,
          dueDate: dueDate || null,
        }),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      onCreated(json.item);
    });
  }

  return (
    <div className="border border-blue-200 rounded-xs p-3 bg-blue-50/40 space-y-2 mt-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Action item title…"
        className="bg-white"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
      />
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="bg-white"
      />
      <div className="grid grid-cols-3 gap-2">
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
          className="h-8 bg-white"
        />
      </div>
      {error && (
        <p className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <Text>
            {error}
          </Text>
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !title.trim()} onClick={submit} className="h-7">
          Add Item
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  onStatusChange,
  onDelete,
  isViewer,
  currentUserId,
  isAdmin,
}: {
  item: ActionItem;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  isViewer: boolean;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const isOverdue =
    item.dueDate &&
    new Date(item.dueDate) < new Date() &&
    item.status !== "done" &&
    item.status !== "cancelled";

  const canDelete = !isViewer && (item.createdBy.id === currentUserId || isAdmin);

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0 group">
      {/* Status toggle */}
      <div className="relative mt-0.5">
        {!isViewer ? (
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="flex items-center gap-0.5 text-slate-400 hover:text-slate-600"
            title="Change status"
          >
            {STATUS_ICON[item.status] ?? <Circle className="h-3.5 w-3.5" />}
            <ChevronDown className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
          </button>
        ) : (
          <div className="mt-0.5">{STATUS_ICON[item.status] ?? <Circle className="h-3.5 w-3.5" />}</div>
        )}

        {showStatusMenu && (
          <div className="absolute left-0 top-6 z-10 bg-white rounded-xs shadow-soft p-1 w-36">
            {ACTION_ITEM_STATUSES.map((s) =>
              s.value !== item.status ? (
                <button
                  key={s.value}
                  onClick={() => { onStatusChange(item.id, s.value); setShowStatusMenu(false); }}
                  className="w-full text-left px-2 py-1.5 rounded-xs hover:bg-blue-50 text-text-secondary hover:text-text-brand"
                >
                  <Text>{s.label}</Text>
                </button>
              ) : null
            )}
          </div>
        )}
      </div>

      {/* Priority dot */}
      <div
        className={`inline-block h-2 w-2 rounded-full flex-shrink-0 mt-1.5 ${PRIORITY_DOT[item.priority] ?? "bg-slate-400"}`}
        title={getLabelForValue(ACTION_ITEM_PRIORITIES, item.priority)}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Text as="p">
          {item.title}
        </Text>
        {item.description && (
          <Text as="p">{item.description}</Text>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
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
          <Text as="span">
            {getLabelForValue(ACTION_ITEM_STATUSES, item.status)}
          </Text>
        </div>
      </div>

      {/* Delete */}
      {canDelete && (
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function ActionItemsSection({
  decisionId,
  initialItems,
  members,
  currentUserId,
  isViewer,
  isAdmin,
}: Props) {
  const [items, setItems] = useState<ActionItem[]>(initialItems);
  const [showForm, setShowForm] = useState(false);
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
    setShowForm(false);
  }

  const open = items.filter((i) => i.status !== "done" && i.status !== "cancelled");
  const done = items.filter((i) => i.status === "done" || i.status === "cancelled");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <Text>
          {open.length} open{items.length > 0 ? ` · ${done.length} done` : ""}
        </Text>
        {!isViewer && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-text-brand hover:text-text-brand"
          >
            <Plus className="h-3.5 w-3.5" />
            <Text>Add item</Text>
          </button>
        )}
      </div>

      {showForm && (
        <AddItemForm
          decisionId={decisionId}
          members={members}
          onCreated={addItem}
          onCancel={() => setShowForm(false)}
        />
      )}

      {items.length === 0 && !showForm && (
        <Text as="p">No action items yet</Text>
      )}

      {items.length > 0 && (
        <div className="mt-2">
          {open.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onStatusChange={changeStatus}
              onDelete={deleteItem}
              isViewer={isViewer}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
          {done.length > 0 && open.length > 0 && (
            <Text as="span">Completed</Text>
          )}
          {done.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onStatusChange={changeStatus}
              onDelete={deleteItem}
              isViewer={isViewer}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
