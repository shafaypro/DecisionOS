import {
  buildWhere,
  describeQuery,
  hasFilters,
  matchesHealthFilter,
  parseSearchDate,
  parseSearchQuery,
} from "../../src/lib/search-query";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const CTX = { userId: "u1" };

export const searchQueryTests = {
  "parses a bare query as free text": () => {
    const q = parseSearchQuery("primary database migration");
    assert(q.text === "primary database migration", "text preserved");
    assert(!hasFilters(q), "no structured filters");
    assert(q.warnings.length === 0, "no warnings");
  },

  "splits filters from free text and keeps quoted phrases intact": () => {
    const q = parseSearchQuery('status:approved "primary database" impact:high');
    assert(q.include.status?.[0] === "approved", "status captured");
    assert(q.include.impact?.[0] === "high", "impact captured");
    assert(q.text === "primary database", "quoted phrase kept as one term");
  },

  "repeating a field ORs the values; a '-' prefix excludes": () => {
    const q = parseSearchQuery("status:approved status:in_review -status:archived");
    assert(q.include.status?.length === 2, "two included statuses");
    assert(q.exclude.status?.[0] === "archived", "exclusion captured");
    const { where } = buildWhere(q, CTX);
    const and = (where.AND as Record<string, unknown>[]) ?? [];
    const inClause = and.find((c) => "status" in c) as { status: { in?: string[] } };
    assert(inClause.status.in?.includes("in_review"), "OR pushed down as an IN");
  },

  "normalizes values: case-insensitive, spaces become underscores": () => {
    const q = parseSearchQuery("status:In_Review category:Engineering");
    assert(q.include.status?.[0] === "in_review", "status lowercased");
    assert(q.include.category?.[0] === "engineering", "category lowercased");
  },

  "unknown filters degrade to free text with a warning - never an error": () => {
    const q = parseSearchQuery("bogus:value database");
    assert(q.warnings.length === 1, "one warning");
    assert(q.text.includes("bogus:value"), "term searched as text");
    assert(q.text.includes("database"), "rest of the text kept");
  },

  "owner:me resolves to the caller": () => {
    const { where } = buildWhere(parseSearchQuery("owner:me"), CTX);
    const and = (where.AND as Record<string, unknown>[]) ?? [];
    const clause = and.find((c) => "ownerUserId" in c) as { ownerUserId: { in: string[] } };
    assert(clause.ownerUserId.in[0] === "u1", "resolved to caller id");
  },

  "is: shorthands expand to real predicates": () => {
    const now = new Date("2025-06-01T00:00:00Z");
    const { where } = buildWhere(parseSearchQuery("is:overdue"), { ...CTX, now });
    const and = (where.AND as Record<string, unknown>[]) ?? [];
    const clause = and.find((c) => "reviewDate" in c) as {
      reviewDate: { lt: Date };
      reviewedAt: null;
    };
    assert(clause.reviewDate.lt.getTime() === now.getTime(), "compares against now");
    assert(clause.reviewedAt === null, "and requires no review yet");
  },

  "an unknown is: flag warns instead of silently matching everything": () => {
    const q = parseSearchQuery("is:sideways");
    assert(q.warnings.length === 1, "warned");
    assert(!q.include.is, "flag dropped");
  },

  "tag filters resolve names to ids and are skipped when unknown": () => {
    const ctx = { userId: "u1", tagIdsByName: { infra: "tag_1" } };
    const { where } = buildWhere(parseSearchQuery("tag:infra"), ctx);
    const and = (where.AND as Record<string, unknown>[]) ?? [];
    const clause = and.find((c) => "tags" in c) as {
      tags: { some: { tagId: { in: string[] } } };
    };
    assert(clause.tags.some.tagId.in[0] === "tag_1", "name mapped to id");

    const { where: none } = buildWhere(parseSearchQuery("tag:nope"), ctx);
    assert(!("AND" in none), "unknown tag adds no clause");
  },

  "parseSearchDate accepts ISO dates and relative windows": () => {
    assert(parseSearchDate("2025-01-15") !== null, "ISO date");
    assert(parseSearchDate("not-a-date") === null, "garbage rejected");
    const rel = parseSearchDate("30d");
    assert(rel !== null, "relative window parsed");
    const ageDays = (Date.now() - rel!.getTime()) / (24 * 60 * 60 * 1000);
    assert(Math.abs(ageDays - 30) < 0.01, "30d is 30 days back");
  },

  "a bad date warns and is dropped rather than filtering to nothing": () => {
    const q = parseSearchQuery("after:yesterdayish");
    assert(q.warnings.length === 1, "warned");
    assert(!q.include.after, "dropped");
  },

  "free text searches title, summary, and the reasoning fields": () => {
    const { where } = buildWhere(parseSearchQuery("postgres"), CTX);
    const and = (where.AND as Record<string, unknown>[]) ?? [];
    const or = and.find((c) => "OR" in c) as { OR: Record<string, unknown>[] };
    assert(or.OR.length === 5, "five text columns searched");
  },

  "health filters are returned for in-memory application, not pushed to SQL": () => {
    const { where, healthFilter } = buildWhere(parseSearchQuery("health:stale -health:archived"), CTX);
    assert(healthFilter.include[0] === "stale", "include captured");
    assert(healthFilter.exclude[0] === "archived", "exclude captured");
    assert(!("AND" in where), "nothing pushed to the DB query");

    assert(matchesHealthFilter("stale", healthFilter), "stale matches");
    assert(!matchesHealthFilter("healthy", healthFilter), "healthy excluded by include list");
    assert(!matchesHealthFilter("archived", healthFilter), "explicit exclusion wins");
  },

  "an empty query builds an empty where - the caller's scoping still applies": () => {
    const { where } = buildWhere(parseSearchQuery(""), CTX);
    assert(Object.keys(where).length === 0, "no clauses");
  },

  "describeQuery renders a readable summary of the active filters": () => {
    const text = describeQuery(parseSearchQuery('status:approved owner:me "auth0"'));
    assert(text.includes("auth0"), "free text shown first");
    assert(text.includes("status: approved"), "filters listed");
  },
};
