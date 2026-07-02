import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  auditContextFromHeaders,
  redactAuditMetadata,
  type AuditAction,
  type AuditOutcome,
} from "./audit";

/**
 * Audit trail writer. Appends immutable entries to the AuditLog table (SOC 2
 * CC6/CC7, GDPR Art. 30/32). Pure catalog/redaction logic lives in `audit.ts`;
 * this module owns the I/O and is `server-only`.
 *
 * Reliability-first but never fatal: callers should `await` so the row is
 * durable before the response returns, yet a write failure is caught and logged
 * (surfacing via error reporting) - auditing must not break the action itself.
 */

export interface AuditActor {
  userId?: string | null;
  email?: string | null;
  workspaceId?: string | null;
}

export interface RecordAuditArgs {
  action: AuditAction;
  actor?: AuditActor;
  targetType?: string;
  targetId?: string | null;
  outcome?: AuditOutcome;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(args: RecordAuditArgs): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: args.action,
        outcome: args.outcome ?? "success",
        workspaceId: args.actor?.workspaceId ?? null,
        actorUserId: args.actor?.userId ?? null,
        actorEmail: args.actor?.email ?? null,
        targetType: args.targetType ?? null,
        targetId: args.targetId ?? null,
        ip: args.ip ?? null,
        userAgent: args.userAgent ?? null,
        metadataJson: redactAuditMetadata(args.metadata),
      },
    });
  } catch (err) {
    logger.error("audit_write_failed", { action: args.action, err });
  }
}

/** The session fields an audited API request needs. */
type AuditSession = { userId: string; email: string; workspaceId: string };

/**
 * Convenience wrapper for the common case: an authenticated API request where
 * the actor is the session user and IP/user-agent come from the request
 * headers. Keeps route call sites to a single line.
 */
export async function auditApiEvent(args: {
  action: AuditAction;
  session: AuditSession;
  req: { headers: { get(name: string): string | null } };
  targetType?: string;
  targetId?: string | null;
  outcome?: AuditOutcome;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { ip, userAgent } = auditContextFromHeaders(args.req.headers);
  await recordAudit({
    action: args.action,
    actor: { userId: args.session.userId, email: args.session.email, workspaceId: args.session.workspaceId },
    targetType: args.targetType,
    targetId: args.targetId,
    outcome: args.outcome,
    metadata: args.metadata,
    ip,
    userAgent,
  });
}
