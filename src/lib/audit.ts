/**
 * Audit trail - pure catalog + helpers (SOC 2 CC6/CC7, GDPR Art. 30/32).
 *
 * The audit log is the tamper-evident record of *who did what* to
 * security-relevant resources: authentication, membership, integrations, SSO,
 * and GDPR data-subject actions (export / erasure). It is deliberately separate
 * from AnalyticsEvent (product metrics) and DecisionEvent (per-decision history).
 *
 * This module is pure - no `prisma`, no `server-only` - so it is edge-safe and
 * unit tested directly. The database writer lives in `audit-log.ts`.
 */

/**
 * The closed catalog of audited actions. Keys are stable machine identifiers
 * (`domain.verb`); values are the human-readable descriptions rendered in the
 * admin audit console. Logging an uncatalogued string is a bug - add the action
 * here first so the set of audited events stays reviewable.
 */
export const AUDIT_ACTIONS = {
  // Authentication
  "auth.login": "Signed in with password",
  "auth.login_failed": "Failed sign-in attempt",
  "auth.sso_login": "Signed in via single sign-on",
  "auth.signup": "Created a new account and workspace",
  "auth.logout": "Signed out",
  // Membership
  "member.invited": "Added a member to the workspace",
  "member.removed": "Removed a member from the workspace",
  // Workspace lifecycle & configuration
  "workspace.updated": "Updated workspace settings",
  "workspace.deleted": "Deleted the workspace and all of its data",
  "integration.updated": "Created or updated an integration",
  "integration.removed": "Removed an integration",
  "sso.updated": "Configured single sign-on",
  "sso.removed": "Removed single sign-on",
  // GDPR data-subject rights
  "account.data_exported": "Exported personal data (GDPR right of access)",
  "account.deleted": "Deleted own account and personal data (GDPR erasure)",
  // Platform (provider) control plane - cross-tenant staff actions. Recorded
  // under the *target* workspace so the customer can see when DecisionOS staff
  // accessed or changed their workspace (a transparency + SOC 2 control).
  "platform.workspace_entered": "Platform administrator accessed this workspace (impersonation)",
  "platform.workspace_exited": "Platform administrator left this workspace",
  "platform.workspace_renamed": "Platform administrator renamed this workspace",
  "platform.workspace_suspended": "Platform administrator changed this workspace's status",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export type AuditOutcome = "success" | "failure";

/** Type guard: is `value` a catalogued audit action? */
export function isAuditAction(value: string): value is AuditAction {
  return Object.prototype.hasOwnProperty.call(AUDIT_ACTIONS, value);
}

/** Human-readable label for an action; falls back to the raw code if unknown. */
export function describeAuditAction(action: string): string {
  return isAuditAction(action) ? AUDIT_ACTIONS[action] : action;
}

/**
 * Keys whose VALUE must never be persisted to the audit table. Unlike the
 * error-reporting scrubber (which strips email for third-party export), the
 * audit log is an internal, admin-only record where identifying WHO acted on
 * WHOM is the point - so emails are kept, but credentials never are.
 */
const SECRET_KEY =
  /(password|passwd|\bpwd\b|\bsecret\b|client[-_ ]?secret|signing[-_ ]?secret|webhook[-_ ]?secret|\btoken\b|access[-_ ]?token|refresh[-_ ]?token|api[-_ ]?key|authorization|cookie|session|\bjwt\b)/i;

/** Bearer header, JWT, Slack token, or a long opaque token - redact by value. */
const SECRET_VALUE = /(bearer\s+[\w.-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+|xox[abprs]-[\w-]+|\b[A-Za-z0-9_-]{40,}\b)/i;

const REDACTED = "[redacted]";
const MAX_METADATA_CHARS = 4_000;

/**
 * Redact and serialize free-form metadata before it is persisted. A defense in
 * depth so a credential can never land in the audit table even if a caller
 * passes one, plus a hard size cap. Returns null for empty input.
 *
 * Pure: builds a new string, never mutates the input.
 */
export function redactAuditMetadata(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  const json = JSON.stringify(metadata, (key, value) => {
    if (key && SECRET_KEY.test(key)) return REDACTED;
    if (typeof value === "string" && SECRET_VALUE.test(value)) return REDACTED;
    return value;
  });
  if (!json) return null;
  return json.length > MAX_METADATA_CHARS ? json.slice(0, MAX_METADATA_CHARS) + "…[truncated]" : json;
}

/**
 * Pull the caller's IP and user-agent from request headers for attribution.
 * Mirrors the leftmost-`x-forwarded-for` preference used by the rate limiter.
 * Pure over the standard Headers `get` interface so it is unit testable.
 */
export function auditContextFromHeaders(headers: {
  get(name: string): string | null;
}): { ip: string | null; userAgent: string | null } {
  const xff = headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0]?.trim() || null : headers.get("x-real-ip");
  return { ip: ip || null, userAgent: headers.get("user-agent") };
}

/**
 * Audit-trail retention. The log is append-only, so its growth is bounded by a
 * scheduled purge (`/api/cron/audit-retention`) rather than by in-place edits.
 * Default is ~18 months; operators override via `AUDIT_RETENTION_DAYS` - a
 * shorter window supports GDPR data-minimization, a longer one a stricter audit
 * commitment.
 */
export const DEFAULT_AUDIT_RETENTION_DAYS = 550;

/**
 * Resolve the configured retention window to a positive integer number of days.
 * Falls back to the default for anything empty, non-integer, or non-positive -
 * a bad `0`/`-1`/`"abc"` must never turn the purge into "delete everything".
 */
export function resolveAuditRetentionDays(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === "") return DEFAULT_AUDIT_RETENTION_DAYS;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_AUDIT_RETENTION_DAYS;
  return n;
}

/** The cutoff instant: audit rows strictly older than this are eligible to purge. */
export function auditRetentionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
