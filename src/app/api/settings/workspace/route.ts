import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { deleteSession } from "@/lib/session";
import { auditApiEvent } from "@/lib/audit-log";

/**
 * DELETE /api/settings/workspace
 * Admin-only. Permanently delete the current workspace and everything in it
 * (decisions, members, notes, integrations, ...). Every Workspace child relation
 * cascades in the Prisma schema, so the delete removes all of it. Clears the
 * caller's session afterwards since it pointed at the now-deleted workspace.
 */
export const DELETE = withApi<undefined>({ require: "admin" }, async ({ session, req }) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
    select: { id: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  await prisma.workspace.delete({ where: { id: workspace.id } });

  // Audited AFTER a successful delete. AuditLog has no FK to Workspace, so the
  // entry survives the cascade and the deletion stays provable for compliance.
  await auditApiEvent({
    action: "workspace.deleted",
    session,
    req,
    targetType: "workspace",
    targetId: workspace.id,
  });

  await deleteSession();

  return NextResponse.json({ success: "Workspace and all of its data have been permanently deleted." });
});
