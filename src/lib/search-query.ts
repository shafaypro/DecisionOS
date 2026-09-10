/**
 * Search query language for the decision log.
 *
 * Free-text search alone forces people back to dropdowns for anything precise
 * ("high-impact engineering decisions Sarah owns that are overdue"). This module
 * parses a small, GitHub-style filter syntax out of the query string so one text
 * box can express the whole question:
 *
 *   status:approved impact:high owner:me tag:infra "primary database"
 *   category:engineering -status:archived health:review-overdue after:2025-01-01
 *
 * Grammar (whitespace-separated terms, order-independent):
 *
 *   field:value      - constrain a field. Repeating a field ORs the values
 *                      (`status:approved status:in_review` = either).
 *   -field:value     - exclude. Repeating ANDs the exclusions.
 *   "quoted phrase"  - a free-text phrase kept intact.
 *   bare words       - free text, joined with spaces.
 *
 * Supported fields: status, category, impact, outcome, owner, tag, health,
 * before, after, is. `owner:me` resolves against the caller. `is:mine`,
 * `is:unowned`, `is:overdue`, `is:draft` are shorthands for common questions.
 *
 * The parser is pure and total: an unknown field or an unparseable date is
 * reported in `warnings` and the term degrades to free text rather than
 * failing the search. Prisma `where` construction lives in `buildWhere`, which
 * takes the parsed query plus the caller's identity - keeping the grammar
 * itself free of any I/O so it can be unit-tested directly.
 */

import type { DecisionHealth } from "./decision-health";

/** Fields the grammar understands. Anything else degrades to free text. */
export const SEARCH_FIELDS = [
  "status",
  "category",
  "impact",
  "outcome",
  "owner",
  "tag",
  "health",
  "before",
  "after",
  "is",
] as const;

export type SearchField = (typeof SEARCH_FIELDS)[number];

/** Shorthands accepted by `is:`. */
export const IS_FLAGS = ["mine", "unowned", "overdue", "draft", "reviewed", "private"] as const;
export type IsFlag = (typeof IS_FLAGS)[number];

export interface ParsedQuery {
  /** Everything that wasn't a recognized filter, joined with single spaces. */
  text: string;
  /** Included values per field, de-duplicated, in first-seen order. */
  include: Partial<Record<SearchField, string[]>>;
  /** Excluded values per field (from `-field:value`). */
  exclude: Partial<Record<SearchField, string[]>>;
  /** Non-fatal problems - unknown fields, bad dates. Surfaced to the user. */
  warnings: string[];
}

/** Split on whitespace but keep "quoted phrases" as single terms. */
function splitTerms(input: string): string[] {
  const terms: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    // A quoted phrase keeps its inner spaces; strip the quotes.
    terms.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return terms.filter((t) => t.length > 0);
}

const FIELD_SET = new Set<string>(SEARCH_FIELDS);
const IS_SET = new Set<string>(IS_FLAGS);

/** Normalize a value: lowercase, and accept `-` or `_` interchangeably. */
function normalizeValue(field: SearchField, raw: string): string {
  const v = raw.trim();
  if (field === "owner" || field === "tag") return v; // names/ids keep their case
  if (field === "before" || field === "after") return v;
  return v.toLowerCase().replace(/\s+/g, "_");
}

function push(bucket: Partial<Record<SearchField, string[]>>, field: SearchField, value: string) {
  const list = bucket[field] ?? (bucket[field] = []);
  if (!list.includes(value)) list.push(value);
}

/** True when `value` parses as a date the DB can compare against. */
export function parseSearchDate(value: string): Date | null {
  // Accept `2025-01-15`, `2025-01-15T10:00:00Z`, and relative `7d` / `3w` / `6m`.
  const rel = /^(\d+)([dwmy])$/.exec(value.trim().toLowerCase());
  if (rel) {
    const n = Number(rel[1]);
    const unitDays = { d: 1, w: 7, m: 30, y: 365 }[rel[2] as "d" | "w" | "m" | "y"];
    return new Date(Date.now() - n * unitDays * 24 * 60 * 60 * 1000);
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/**
 * Parse a raw search box value into filters plus leftover free text.
 * Never throws: malformed input becomes free text plus a warning.
 */
export function parseSearchQuery(input: string): ParsedQuery {
  const parsed: ParsedQuery = { text: "", include: {}, exclude: {}, warnings: [] };
  const freeText: string[] = [];

  for (const term of splitTerms(input ?? "")) {
    const negated = term.startsWith("-") && term.length > 1;
    const body = negated ? term.slice(1) : term;
    const colon = body.indexOf(":");

    if (colon <= 0 || colon === body.length - 1) {
      freeText.push(term);
      continue;
    }

    const rawField = body.slice(0, colon).toLowerCase();
    const rawValue = body.slice(colon + 1);

    if (!FIELD_SET.has(rawField)) {
      parsed.warnings.push(`Unknown filter "${rawField}:" - searched as text instead.`);
      freeText.push(term);
      continue;
    }

    const field = rawField as SearchField;
    const value = normalizeValue(field, rawValue);

    if ((field === "before" || field === "after") && parseSearchDate(value) === null) {
      parsed.warnings.push(`"${rawField}:${rawValue}" isn't a date - ignored.`);
      continue;
    }
    if (field === "is" && !IS_SET.has(value)) {
      parsed.warnings.push(
        `Unknown "is:${rawValue}" - try ${IS_FLAGS.map((f) => `is:${f}`).join(", ")}.`,
      );
      continue;
    }

    push(negated ? parsed.exclude : parsed.include, field, value);
  }

  parsed.text = freeText.join(" ").trim();
  return parsed;
}

/** True when the query carries at least one structured filter. */
export function hasFilters(q: ParsedQuery): boolean {
  return Object.keys(q.include).length > 0 || Object.keys(q.exclude).length > 0;
}

export interface BuildWhereContext {
  /** Caller's user id - resolves `owner:me`, `is:mine`, `is:private`. */
  userId: string;
  /** Map of lowercased tag name → tag id, for `tag:` terms. */
  tagIdsByName?: Record<string, string>;
  /** "Now" for relative date filters; injectable so tests are deterministic. */
  now?: Date;
}

/** A Prisma-compatible `where` fragment. Deliberately loose - it is spread into
 *  the caller's own scoping filter (workspace + visibility) which owns tenancy. */
export type WhereFragment = Record<string, unknown>;

/** Fields whose values map straight onto a Decision column. */
const COLUMN_BY_FIELD: Partial<Record<SearchField, string>> = {
  status: "status",
  category: "category",
  impact: "impactLevel",
  outcome: "outcomeStatus",
};

/**
 * Translate a parsed query into a Prisma `where` fragment.
 *
 * Health filters can't be expressed in SQL (health is derived), so they are
 * returned separately in `healthFilter` for the caller to apply in memory after
 * fetching. Everything else is pushed down to the database.
 */
export function buildWhere(
  q: ParsedQuery,
  ctx: BuildWhereContext,
): { where: WhereFragment; healthFilter: { include: string[]; exclude: string[] } } {
  const and: WhereFragment[] = [];
  const now = ctx.now ?? new Date();

  for (const [field, column] of Object.entries(COLUMN_BY_FIELD) as [SearchField, string][]) {
    const inc = q.include[field];
    if (inc?.length) and.push({ [column]: { in: inc } });
    const exc = q.exclude[field];
    if (exc?.length) and.push({ [column]: { notIn: exc } });
  }

  const owners = q.include.owner?.map((o) => (o.toLowerCase() === "me" ? ctx.userId : o));
  if (owners?.length) and.push({ ownerUserId: { in: owners } });
  const notOwners = q.exclude.owner?.map((o) => (o.toLowerCase() === "me" ? ctx.userId : o));
  if (notOwners?.length) and.push({ ownerUserId: { notIn: notOwners } });

  const tagIds = (q.include.tag ?? [])
    .map((t) => ctx.tagIdsByName?.[t.toLowerCase()])
    .filter((id): id is string => Boolean(id));
  if (tagIds.length) and.push({ tags: { some: { tagId: { in: tagIds } } } });
  const notTagIds = (q.exclude.tag ?? [])
    .map((t) => ctx.tagIdsByName?.[t.toLowerCase()])
    .filter((id): id is string => Boolean(id));
  if (notTagIds.length) and.push({ tags: { none: { tagId: { in: notTagIds } } } });

  for (const raw of q.include.before ?? []) {
    const d = parseSearchDate(raw);
    if (d) and.push({ updatedAt: { lte: d } });
  }
  for (const raw of q.include.after ?? []) {
    const d = parseSearchDate(raw);
    if (d) and.push({ updatedAt: { gte: d } });
  }

  for (const flag of q.include.is ?? []) {
    switch (flag as IsFlag) {
      case "mine":
        and.push({ OR: [{ ownerUserId: ctx.userId }, { createdByUserId: ctx.userId }] });
        break;
      case "unowned":
        and.push({ ownerUserId: null });
        break;
      case "overdue":
        and.push({ reviewDate: { lt: now }, reviewedAt: null });
        break;
      case "draft":
        and.push({ status: { in: ["draft", "proposed"] } });
        break;
      case "reviewed":
        and.push({ reviewedAt: { not: null } });
        break;
      case "private":
        and.push({ visibility: { not: "workspace" } });
        break;
    }
  }

  if (q.text) {
    and.push({
      OR: [
        { title: { contains: q.text } },
        { summary: { contains: q.text } },
        { rationale: { contains: q.text } },
        { problemStatement: { contains: q.text } },
        { chosenOption: { contains: q.text } },
      ],
    });
  }

  return {
    where: and.length > 0 ? { AND: and } : {},
    healthFilter: {
      include: q.include.health ?? [],
      exclude: q.exclude.health ?? [],
    },
  };
}

/** Apply the in-memory half of the query (derived health). */
export function matchesHealthFilter(
  health: DecisionHealth,
  filter: { include: string[]; exclude: string[] },
): boolean {
  if (filter.exclude.includes(health)) return false;
  if (filter.include.length > 0 && !filter.include.includes(health)) return false;
  return true;
}

/** Human-readable summary of the active filters - shown next to the results. */
export function describeQuery(q: ParsedQuery): string {
  const parts: string[] = [];
  for (const field of SEARCH_FIELDS) {
    const inc = q.include[field];
    if (inc?.length) parts.push(`${field}: ${inc.join(" or ")}`);
    const exc = q.exclude[field];
    if (exc?.length) parts.push(`not ${field}: ${exc.join(", ")}`);
  }
  if (q.text) parts.unshift(`“${q.text}”`);
  return parts.join(" · ");
}

/** Documentation rows for the search-syntax help popover. */
export const SEARCH_SYNTAX_HELP: { example: string; meaning: string }[] = [
  { example: "status:approved", meaning: "Only approved decisions" },
  { example: "status:approved status:in_review", meaning: "Either status (repeats OR together)" },
  { example: "-status:archived", meaning: "Exclude archived decisions" },
  { example: "owner:me", meaning: "Decisions you own" },
  { example: "is:overdue", meaning: "Review date passed with no review" },
  { example: "is:unowned", meaning: "No owner assigned" },
  { example: "impact:high category:engineering", meaning: "Combine filters (ANDed)" },
  { example: "tag:infra", meaning: "Carries the infra tag" },
  { example: "health:review-overdue", meaning: "Filter on the derived health signal" },
  { example: "after:2025-01-01", meaning: "Updated on or after a date" },
  { example: "after:30d", meaning: "Updated in the last 30 days" },
  { example: '"primary database"', meaning: "Exact phrase in the text fields" },
];
