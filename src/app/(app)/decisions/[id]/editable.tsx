"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Row } from "./row";
import { Row as ListRow } from "@/components/ui/row";
import { Text } from "@/components/ui/text";
import { Plus, Check, Pencil } from "lucide-react";
import { TEXT_SIZE } from "@/lib/typography";
import { cn, STATUS_COLORS, STATUSES, getLabelForValue } from "@/lib/utils";

/** Pencil that fades in on row hover - the edit affordance for inline-editable rows.
 *  Smallest (24px) icon button; pointer-events-none so the row's own click handles it. */
const editAffordance = (
  <Button
    size="sm"
    variant="ghost"
    aria-hidden
    tabIndex={-1}
    className="pointer-events-none shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100"
    icon={<Pencil className="h-3.5 w-3.5" />}
  />
);

/** Sidebar-style hover interactivity for an inline-editable row: darker resting text, darkens on hover. */
const EDITABLE_ROW = "px-0 text-slate-600 hover:text-slate-800";

async function patchField(id: string, field: string, value: string | null) {
  const res = await fetch(`/api/decisions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [field]: value }),
  });
  return res.json() as Promise<{ error?: string }>;
}

/**
 * Click-to-edit text. Display and edit states share typography so the field
 * looks identical until focused - WYSIWYG, no separate edit mode. Saves on
 * blur; Esc cancels; Enter saves a title, Cmd/Ctrl+Enter saves prose.
 */
export function EditableText({
  decisionId, field, value, placeholder, variant = "prose",
}: {
  decisionId: string;
  field: string;
  value: string | null;
  placeholder: string;
  variant?: "title" | "prose";
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const isTitle = variant === "title";
  const typo = isTitle
    ? cn(TEXT_SIZE.xl, "font-bold text-text-primary")
    : cn(TEXT_SIZE.sm, "text-text-primary leading-relaxed");

  // Re-sync local draft when the server value changes (React's adjust-on-prop pattern).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setVal(value ?? "");
  }

  function autosize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    autosize();
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  async function save() {
    setEditing(false);
    const next = val.trim();
    const orig = (value ?? "").trim();
    if (next === orig) { setVal(value ?? ""); return; }
    if (isTitle && next.length < 3) {
      toast.error("Title must be at least 3 characters.");
      setVal(value ?? "");
      return;
    }
    setSaving(true);
    const data = await patchField(decisionId, field, isTitle ? next : (next || null));
    setSaving(false);
    if (data.error) { toast.error(data.error); setVal(value ?? ""); }
    else router.refresh();
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        rows={1}
        value={val}
        onChange={(e) => { setVal(e.target.value); autosize(); }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setVal(value ?? ""); setEditing(false); }
          if (e.key === "Enter" && (isTitle || e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
        className={cn(
          "block w-full resize-none overflow-hidden whitespace-pre-wrap rounded-xs bg-transparent px-2 py-1 -mx-2 outline-none",
          !isTitle && "ring-1 ring-blue-300 focus:ring-blue-400",
          typo,
        )}
      />
    );
  }

  return (
    <div
      role="textbox"
      tabIndex={0}
      onClick={() => !saving && setEditing(true)}
      onFocus={() => !saving && setEditing(true)}
      className={cn(
        "cursor-text whitespace-pre-wrap rounded-xs px-2 py-1 -mx-2 transition-colors hover:bg-slate-50 focus:bg-slate-50 outline-none",
        typo,
        !value && "text-text-subtle",
      )}
    >
      {value || placeholder}
    </div>
  );
}

/**
 * A decision field rendered as a fill-in affordance. Empty: grey Plus icon + label.
 * Hover darkens. Click → blue icon + label, bare textarea (caret) opens below. On
 * save with content the Plus morphs into a green Check. Enter saves and advances to
 * the next field; Shift+Enter inserts a newline.
 */
export function EditableField({
  decisionId, field, label, value, placeholder,
}: {
  decisionId: string;
  field: string;
  label: string;
  value: string | null;
  placeholder: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Display keys off the local draft (not the prop) so a just-saved value stays
  // on screen through router.refresh() instead of flickering empty.
  const hasValue = val.trim().length > 0;
  const showCheck = hasValue && !editing;

  // Open a sibling field affordance (Enter/ArrowDown advance, ArrowUp goes back).
  function focusSibling(dir: 1 | -1) {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-field-editor]"),
    );
    const i = rootRef.current ? nodes.indexOf(rootRef.current) : -1;
    nodes[i + dir]?.querySelector("button")?.click();
  }

  // Re-sync local draft when the server value changes (adjust-on-prop pattern).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setVal(value ?? "");
  }

  function autosize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    autosize();
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  async function save() {
    setEditing(false);
    const next = val.trim();
    const orig = (value ?? "").trim();
    if (next === orig) { setVal(value ?? ""); return; }
    setSaving(true);
    const data = await patchField(decisionId, field, next || null);
    setSaving(false);
    if (data.error) { toast.error(data.error); setVal(value ?? ""); }
    else router.refresh();
  }

  return (
    <Row
      ref={rootRef}
      data-field-editor
      label={
        <div className="flex items-center gap-2">
          {/* Plain button (not <Button>) on purpose: the Plus↔Check morph animates
              svg opacity, which <Button>'s blanket [&_svg]:opacity rules would override. */}
          <button
            type="button"
            onClick={() => !saving && setEditing(true)}
            aria-expanded={editing}
            aria-label={label}
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
              editing ? "bg-slate-100" : "group-hover:bg-slate-100",
            )}
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              <Plus
                className={cn(
                  "absolute h-4 w-4 transition-all duration-300",
                  editing ? "text-blue-600/90" : "text-slate-400 group-hover:text-slate-600",
                  showCheck ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
                )}
              />
              <Check
                className={cn(
                  "absolute h-4 w-4 text-emerald-500 transition-all duration-300",
                  showCheck ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0",
                )}
              />
            </span>
          </button>
          <button type="button" onClick={() => !saving && setEditing(true)} className="text-left">
            <Text
              as="h3"
              size="base"
              weight="semibold"
              color="secondary"
              className={editing ? "text-blue-600/90" : "group-hover:text-text-primary"}
            >
              {label}
            </Text>
          </button>
        </div>
      }
    >
      {editing ? (
        <textarea
          ref={ref}
          rows={1}
          value={val}
          placeholder={placeholder}
          onChange={(e) => { setVal(e.target.value); autosize(); }}
          onBlur={save}
          onKeyDown={(e) => {
            // Ignore keys mid-IME-composition (Enter confirms a candidate, not submit).
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Escape") { setVal(value ?? ""); setEditing(false); }
            // Enter saves and advances; Shift+Enter inserts a newline. Blur (not a
            // direct save() call) so onBlur stays the single save path - no double PATCH.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ref.current?.blur();
              focusSibling(1);
            }
            // Arrow up/down move between fields, but only at the caret boundary so
            // multi-line editing within a field still works.
            const el = ref.current;
            if (e.key === "ArrowUp" && el && el.selectionStart === 0) {
              e.preventDefault();
              el.blur();
              focusSibling(-1);
            }
            if (e.key === "ArrowDown" && el && el.selectionEnd === el.value.length) {
              e.preventDefault();
              el.blur();
              focusSibling(1);
            }
          }}
          className={cn(
            TEXT_SIZE.base,
            "block w-full resize-none overflow-hidden whitespace-pre-wrap bg-transparent leading-relaxed text-text-primary caret-blue-500 outline-none lg:mt-px",
          )}
        />
      ) : hasValue ? (
        <Text
          as="div"
          size="base"
          color="secondary"
          onClick={() => !saving && setEditing(true)}
          className="cursor-text whitespace-pre-wrap leading-relaxed lg:mt-px group-hover:text-text-primary"
        >
          {val}
        </Text>
      ) : (
        <Text
          as="div"
          size="base"
          onClick={() => !saving && setEditing(true)}
          className="cursor-text leading-relaxed text-slate-400 transition-colors group-hover:text-slate-600 lg:mt-px"
        >
          Start typing…
        </Text>
      )}
    </Row>
  );
}

/** Status pill that opens a dropdown on click. */
export function EditableStatus({
  decisionId, value,
}: {
  decisionId: string;
  value: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function onChange(next: string) {
    if (next === value) return;
    setSaving(true);
    const data = await patchField(decisionId, "status", next);
    setSaving(false);
    if (data.error) toast.error(data.error);
    else router.refresh();
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={saving}>
      <SelectTrigger
        className={cn(
          "inline-flex h-6 w-auto items-center gap-1 rounded-full border px-2 tracking-tighter !shadow-none [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60",
          STATUS_COLORS[value] ?? "bg-slate-100 text-slate-600 border-slate-200",
        )}
      >
        <span className="caps-label">{getLabelForValue(STATUSES, value)}</span>
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Generic borderless inline select (used for owner). */
export function EditableSelect({
  decisionId, field, value, options, placeholder, icon,
}: {
  decisionId: string;
  field: string;
  value: string | null;
  options: { value: string; label: string }[];
  placeholder: string;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const NONE = "__none__";

  async function onChange(next: string) {
    const val = next === NONE ? null : next;
    if ((val ?? "") === (value ?? "")) return;
    setSaving(true);
    const data = await patchField(decisionId, field, val);
    setSaving(false);
    if (data.error) toast.error(data.error);
    else router.refresh();
  }

  return (
    <Select value={value ?? NONE} onValueChange={onChange} disabled={saving}>
      <SelectPrimitive.Trigger asChild>
        <ListRow
          className={EDITABLE_ROW}
          align="center"
          leading={icon}
          title={
            <div className="flex items-center justify-between gap-2">
              <SelectValue placeholder={placeholder} />
              {editAffordance}
            </div>
          }
        />
      </SelectPrimitive.Trigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Native date input - inline, borderless. `value` is an ISO date string. */
export function EditableDate({
  decisionId, field, value, icon, prefix,
}: {
  decisionId: string;
  field: string;
  value: string | null;
  icon?: React.ReactNode;
  prefix?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onChange(next: string) {
    setSaving(true);
    const data = await patchField(decisionId, field, next || null);
    setSaving(false);
    if (data.error) toast.error(data.error);
    else router.refresh();
  }

  return (
    <ListRow
      className={EDITABLE_ROW}
      align="center"
      leading={icon}
      onClick={() => inputRef.current?.showPicker?.()}
      title={
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            {prefix && <span>{prefix}</span>}
            <input
              ref={inputRef}
              type="date"
              value={value ? value.slice(0, 10) : ""}
              disabled={saving}
              onChange={(e) => onChange(e.target.value)}
              className={cn(
                TEXT_SIZE.sm,
                "cursor-pointer bg-transparent text-inherit outline-none [&::-webkit-calendar-picker-indicator]:hidden",
              )}
            />
          </span>
          {editAffordance}
        </div>
      }
    />
  );
}
