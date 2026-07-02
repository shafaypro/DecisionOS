import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy");
}

export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const CATEGORIES = [
  { value: "product",     label: "Product" },
  { value: "engineering", label: "Engineering" },
  { value: "business",    label: "Business" },
  { value: "hiring",      label: "Hiring" },
  { value: "finance",     label: "Finance" },
  { value: "marketing",   label: "Marketing" },
  { value: "strategy",    label: "Strategy" },
  { value: "operations",  label: "Operations" },
  { value: "other",       label: "Other" },
] as const;

export const STATUSES = [
  { value: "proposed",   label: "Proposed",   hint: "Under discussion, no final call yet" },
  { value: "in_review",  label: "In Review",  hint: "Awaiting sign-off from stakeholders" },
  { value: "approved",   label: "Approved",   hint: "Decided and in effect" },
  { value: "reversed",   label: "Reversed",   hint: "Was approved but later undone" },
  { value: "superseded", label: "Superseded", hint: "Replaced by a newer decision" },
  { value: "archived",   label: "Archived",   hint: "No longer active, kept for reference" },
] as const;

export const OUTCOME_STATUSES = [
  { value: "unknown", label: "Unknown" },
  { value: "successful", label: "Successful" },
  { value: "mixed", label: "Mixed" },
  { value: "unsuccessful", label: "Unsuccessful" },
] as const;

export const IMPACT_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export const LINK_TYPES = [
  { value: "doc", label: "Document" },
  { value: "ticket", label: "Ticket" },
  { value: "pull_request", label: "Pull Request" },
  { value: "issue", label: "Issue" },
  { value: "meeting_note", label: "Meeting Note" },
  { value: "other", label: "Other" },
] as const;

export const ACTION_ITEM_STATUSES = [
  { value: "open",        label: "Open",        color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "in_progress", label: "In Progress",  color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "in_review",   label: "In Review",    color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "done",        label: "Done",         color: "bg-green-50 text-green-700 border-green-200" },
  { value: "cancelled",   label: "Cancelled",    color: "bg-slate-100 text-slate-400 border-slate-200" },
] as const;

export const ACTION_ITEM_PRIORITIES = [
  { value: "low",      label: "Low",      color: "text-slate-500",  dot: "bg-slate-400" },
  { value: "medium",   label: "Medium",   color: "text-amber-600",  dot: "bg-amber-400" },
  { value: "high",     label: "High",     color: "text-orange-600", dot: "bg-orange-500" },
  { value: "critical", label: "Critical", color: "text-red-600",    dot: "bg-red-500" },
] as const;

export type ActionItemStatus   = typeof ACTION_ITEM_STATUSES[number]["value"];
export type ActionItemPriority = typeof ACTION_ITEM_PRIORITIES[number]["value"];

export const RELATION_TYPES = [
  { value: "supersedes",     label: "Supersedes" },
  { value: "depends_on",     label: "Depends on" },
  { value: "relates_to",     label: "Relates to" },
  { value: "conflicts_with", label: "Conflicts with" },
] as const;

export const INTEGRATION_TYPES = [
  { value: "slack",  label: "Slack" },
  { value: "teams",  label: "Microsoft Teams" },
  { value: "email",  label: "Email (SMTP)" },
] as const;

export type RelationType = typeof RELATION_TYPES[number]["value"];
export type IntegrationType = typeof INTEGRATION_TYPES[number]["value"];
export type Category = typeof CATEGORIES[number]["value"];
export type Status = typeof STATUSES[number]["value"];
export type OutcomeStatus = typeof OUTCOME_STATUSES[number]["value"];
export type ImpactLevel = typeof IMPACT_LEVELS[number]["value"];
export type LinkType = typeof LINK_TYPES[number]["value"];

export const STATUS_COLORS: Record<string, string> = {
  proposed:   "bg-blue-50 text-blue-700 border-blue-200",
  in_review:  "bg-violet-50 text-violet-700 border-violet-200",
  approved:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  reversed:   "bg-rose-50 text-rose-700 border-rose-200",
  superseded: "bg-amber-50 text-amber-700 border-amber-200",
  archived:   "bg-slate-50 text-slate-500 border-slate-200",
  // Legacy values - map gracefully
  draft:        "bg-slate-100 text-slate-700 border-slate-200",
  decided:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  under_review: "bg-violet-50 text-violet-700 border-violet-200",
  validated:    "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const OUTCOME_COLORS: Record<string, string> = {
  unknown: "bg-slate-100 text-slate-600 border-slate-200",
  successful: "bg-green-50 text-green-700 border-green-200",
  mixed: "bg-amber-50 text-amber-700 border-amber-200",
  unsuccessful: "bg-red-50 text-red-700 border-red-200",
};

export const IMPACT_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200",
};

export const CATEGORY_COLORS: Record<string, string> = {
  product:     "bg-violet-50 text-violet-700 border-violet-200",
  engineering: "bg-blue-50 text-blue-700 border-blue-200",
  business:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  hiring:      "bg-pink-50 text-pink-700 border-pink-200",
  operations:  "bg-orange-50 text-orange-700 border-orange-200",
  finance:     "bg-teal-50 text-teal-700 border-teal-200",
  marketing:   "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  strategy:    "bg-cyan-50 text-cyan-700 border-cyan-200",
  other:       "bg-slate-100 text-slate-600 border-slate-200",
};

/** Memory retrieval score (0-100) → pill tone. Green good, amber middling, red poor. */
export function memoryScoreTone(score: number): string {
  return score >= 67
    ? "bg-green-50 border-green-200 text-green-700"
    : score >= 34
    ? "bg-amber-50 border-amber-200 text-amber-700"
    : "bg-red-50 border-red-200 text-red-700";
}

/** Blast radius → pill tone. Louder color = more dependents. */
export function blastRadiusTone(count: number): string {
  return count >= 5
    ? "bg-rose-50 border-rose-200 text-rose-700"
    : count >= 2
    ? "bg-amber-50 border-amber-200 text-amber-700"
    : "bg-slate-50 border-slate-200 text-slate-600";
}

export function getLabelForValue<T extends { value: string; label: string }>(
  options: readonly T[],
  value: string
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
