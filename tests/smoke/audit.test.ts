import {
  AUDIT_ACTIONS,
  isAuditAction,
  describeAuditAction,
  redactAuditMetadata,
  auditContextFromHeaders,
  resolveAuditRetentionDays,
  auditRetentionCutoff,
  DEFAULT_AUDIT_RETENTION_DAYS,
} from "../../src/lib/audit";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function headers(map: Record<string, string>) {
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

export const auditTests = {
  "catalog is closed: isAuditAction accepts known, rejects unknown": () => {
    assert(isAuditAction("auth.login"), "auth.login must be catalogued");
    assert(isAuditAction("account.deleted"), "account.deleted must be catalogued");
    assert(isAuditAction("platform.workspace_entered"), "platform impersonation must be catalogued");
    assert(!isAuditAction("auth.login_hax"), "uncatalogued action must be rejected");
    assert(!isAuditAction(""), "empty string must be rejected");
    assert(!isAuditAction("toString"), "prototype keys must not leak through the guard");
  },

  "describeAuditAction returns label for known, echoes unknown": () => {
    assert(
      describeAuditAction("account.data_exported") === AUDIT_ACTIONS["account.data_exported"],
      "known action must resolve to its catalog label",
    );
    assert(describeAuditAction("mystery.action") === "mystery.action", "unknown action echoes its code");
  },

  "redactAuditMetadata returns null for empty input": () => {
    assert(redactAuditMetadata(undefined) === null, "undefined → null");
    assert(redactAuditMetadata({}) === null, "empty object → null");
  },

  "redactAuditMetadata strips secret-looking keys but keeps emails": () => {
    const json = redactAuditMetadata({
      targetEmail: "victim@acme.com",
      role: "admin",
      apiKey: "sk-should-not-appear",
      clientSecret: "top-secret-value",
    });
    assert(json !== null, "non-empty metadata must serialize");
    const parsed = JSON.parse(json as string);
    assert(parsed.targetEmail === "victim@acme.com", "emails are kept for internal attribution");
    assert(parsed.role === "admin", "benign fields are kept");
    assert(parsed.apiKey === "[redacted]", "apiKey value must be redacted");
    assert(parsed.clientSecret === "[redacted]", "clientSecret value must be redacted");
    assert(!(json as string).includes("sk-should-not-appear"), "no secret substring may survive");
  },

  "redactAuditMetadata redacts token-shaped values regardless of key": () => {
    const json = redactAuditMetadata({ note: "Bearer abc.def.ghijklmnop" }) as string;
    const parsed = JSON.parse(json);
    assert(parsed.note === "[redacted]", "bearer-token-shaped value must be redacted");
  },

  "redactAuditMetadata caps runaway payload size": () => {
    // A long but non-secret-shaped value (spaces break the opaque-token rule).
    const json = redactAuditMetadata({ blob: "data point ".repeat(1_000) }) as string;
    assert(json.length <= 4_000 + 20, "serialized metadata must be size-capped");
    assert(json.endsWith("…[truncated]"), "cap must mark truncation");
  },

  "auditContextFromHeaders prefers leftmost x-forwarded-for": () => {
    const ctx = auditContextFromHeaders(
      headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "Mozilla/5.0" }),
    );
    assert(ctx.ip === "203.0.113.9", "leftmost XFF entry wins");
    assert(ctx.userAgent === "Mozilla/5.0", "user-agent is captured");
  },

  "auditContextFromHeaders falls back to x-real-ip then null": () => {
    assert(auditContextFromHeaders(headers({ "x-real-ip": "198.51.100.7" })).ip === "198.51.100.7", "x-real-ip fallback");
    const empty = auditContextFromHeaders(headers({}));
    assert(empty.ip === null, "missing IP → null");
    assert(empty.userAgent === null, "missing UA → null");
  },

  "resolveAuditRetentionDays honours a valid positive integer": () => {
    assert(resolveAuditRetentionDays("30") === 30, "explicit 30 days honoured");
    assert(resolveAuditRetentionDays("7") === 7, "short window (data-minimization) honoured");
    assert(resolveAuditRetentionDays("3650") === 3650, "long window honoured");
  },

  "resolveAuditRetentionDays falls back to default for empty/invalid/non-positive": () => {
    assert(resolveAuditRetentionDays(undefined) === DEFAULT_AUDIT_RETENTION_DAYS, "undefined → default");
    assert(resolveAuditRetentionDays(null) === DEFAULT_AUDIT_RETENTION_DAYS, "null → default");
    assert(resolveAuditRetentionDays("  ") === DEFAULT_AUDIT_RETENTION_DAYS, "blank → default");
    assert(resolveAuditRetentionDays("abc") === DEFAULT_AUDIT_RETENTION_DAYS, "non-numeric → default");
    assert(resolveAuditRetentionDays("30.5") === DEFAULT_AUDIT_RETENTION_DAYS, "non-integer → default");
    // The safety-critical cases: never let a bad value purge the whole trail.
    assert(resolveAuditRetentionDays("0") === DEFAULT_AUDIT_RETENTION_DAYS, "0 → default (never delete-all)");
    assert(resolveAuditRetentionDays("-5") === DEFAULT_AUDIT_RETENTION_DAYS, "negative → default");
  },

  "auditRetentionCutoff subtracts the given days from now": () => {
    const now = new Date("2026-07-01T00:00:00.000Z");
    const cutoff = auditRetentionCutoff(now, 30);
    assert(cutoff.toISOString() === "2026-06-01T00:00:00.000Z", "30 days before 2026-07-01 is 2026-06-01");
    // A larger window pushes the cutoff further into the past (keeps more rows).
    assert(auditRetentionCutoff(now, 60).getTime() < cutoff.getTime(), "longer retention → earlier cutoff");
  },
};
