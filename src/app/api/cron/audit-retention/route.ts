/**
 * Nightly cron: enforce audit-log retention.
 *
 * The AuditLog trail is append-only - no route ever UPDATEs or DELETEs a row
 * during normal operation - so this scheduled purge is the single, deliberate
 * path that removes data. It deletes entries older than `AUDIT_RETENTION_DAYS`
 * (default ~18 months), bounding table growth and satisfying GDPR data
 * minimization / a documented SOC 2 retention policy without ever rewriting
 * history in place.
 *
 * Triggered by Vercel Cron (vercel.json), GitHub Actions, or any scheduler that
 * can make an authenticated HTTP GET request.
 *
 * Authentication: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCron } from "@/lib/env";
import { resolveAuditRetentionDays, auditRetentionCutoff } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retentionDays = resolveAuditRetentionDays(process.env.AUDIT_RETENTION_DAYS);
  const cutoff = auditRetentionCutoff(new Date(), retentionDays);

  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  logger.info("audit_retention_purge", {
    retentionDays,
    cutoff: cutoff.toISOString(),
    deleted: count,
  });

  return NextResponse.json({
    ok: true,
    retentionDays,
    cutoff: cutoff.toISOString(),
    deleted: count,
  });
}

// Accept POST as well as GET - schedulers disagree on the verb (Vercel/GCP use
// GET; EC2/ECS/Kubernetes POST), so both must reach the same handler.
export const POST = GET;
