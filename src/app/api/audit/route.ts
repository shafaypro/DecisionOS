import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { describeAuditAction } from "@/lib/audit";

/**
 * GET /api/audit - the workspace's security audit trail.
 *
 * Admin only and tenant-scoped: an admin only ever sees their own workspace's
 * entries. Cursor-paginated, newest first. Read-only by design - the trail is
 * append-only and exposes no mutation endpoints, so nobody (not even an admin)
 * can rewrite history through the API.
 */
export const GET = withApi<undefined>({ require: "admin" }, async ({ session, req }) => {
  const url = new URL(req.url);
  const take = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const cursor = url.searchParams.get("cursor");

  const rows = await prisma.auditLog.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasMore = rows.length > take;
  const page = rows.slice(0, take);

  return NextResponse.json({
    entries: page.map((r) => ({
      id: r.id,
      action: r.action,
      description: describeAuditAction(r.action),
      actorEmail: r.actorEmail,
      targetType: r.targetType,
      targetId: r.targetId,
      outcome: r.outcome,
      ip: r.ip,
      metadata: safeParse(r.metadataJson),
      createdAt: r.createdAt,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  });
});

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
