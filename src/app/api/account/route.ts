import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { deleteSession } from "@/lib/session";
import { track } from "@/lib/analytics";
import { auditApiEvent } from "@/lib/audit-log";

/**
 * DELETE /api/account
 * GDPR right to erasure: permanently delete the signed-in user and all of their
 * personal data. The Prisma schema cascades every User child relation (notes,
 * reviews, events, reactions, memberships, ...), so the delete removes it all.
 *
 * Guard: if the user is the SOLE admin of any workspace, deleting them would
 * orphan that workspace. Refuse and tell them to delete or transfer it first
 * (mirrors the last-admin guard in /api/team/[id]). Workspace-owned Stripe
 * subscriptions are handled by the separate workspace-delete route.
 */
export const DELETE = withApi<undefined>({ require: "auth" }, async ({ session, req }) => {
  const adminMemberships = await prisma.workspaceMembership.findMany({
    where: { userId: session.userId, role: "admin" },
    select: { workspaceId: true },
  });

  for (const m of adminMemberships) {
    const adminCount = await prisma.workspaceMembership.count({
      where: { workspaceId: m.workspaceId, role: "admin" },
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        {
          error:
            "You are the sole admin of a workspace. Delete that workspace (or make someone else an admin) before deleting your account.",
        },
        { status: 400 },
      );
    }
  }

  track({ event: "member.removed", userId: session.userId, source: "web", props: { reason: "account_deleted" } });

  await prisma.user.delete({ where: { id: session.userId } });

  // Audited AFTER the delete succeeds; the trail outlives the user (no FK) so
  // the erasure itself remains provable for compliance.
  await auditApiEvent({
    action: "account.deleted",
    session,
    req,
    targetType: "user",
    targetId: session.userId,
  });

  await deleteSession();

  return NextResponse.json({ success: "Your account and personal data have been permanently deleted." });
});
