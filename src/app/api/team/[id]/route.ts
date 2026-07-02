import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { isPlatformAdminEmail } from "@/lib/env";
import { track } from "@/lib/analytics";
import { auditApiEvent } from "@/lib/audit-log";

/**
 * DELETE /api/team/[id]
 * Remove a member from the workspace by membership id. Admin only.
 *
 * - Tenant-scoped: a membership from another workspace returns 404 (not 403)
 *   so existence isn't leaked.
 * - Guards against removing the workspace's last admin (which would orphan it).
 */
export const DELETE = withApi<undefined, { id: string }>(
  { require: "admin" },
  async ({ session, params, req }) => {
    const membership = await prisma.workspaceMembership.findUnique({
      where: { id: params.id },
      select: { id: true, workspaceId: true, userId: true, role: true, user: { select: { email: true } } },
    });

    if (!membership || membership.workspaceId !== session.workspaceId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // The main admin (a platform super-admin, per the PLATFORM_ADMIN_EMAILS
    // allow-list) cannot be removed - not even by a workspace admin.
    if (isPlatformAdminEmail(membership.user.email)) {
      return NextResponse.json(
        { error: "Cannot remove a platform administrator." },
        { status: 400 },
      );
    }

    if (membership.role === "admin") {
      const adminCount = await prisma.workspaceMembership.count({
        where: { workspaceId: session.workspaceId, role: "admin" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin of the workspace." },
          { status: 400 },
        );
      }
    }

    await prisma.workspaceMembership.delete({ where: { id: membership.id } });

    track({
      event: "member.removed",
      workspaceId: session.workspaceId,
      userId: membership.userId,
      source: "api",
    });
    await auditApiEvent({
      action: "member.removed",
      session,
      req,
      targetType: "user",
      targetId: membership.userId,
      metadata: { targetEmail: membership.user.email, role: membership.role },
    });

    return NextResponse.json({ success: "Member removed from the workspace." });
  },
);
