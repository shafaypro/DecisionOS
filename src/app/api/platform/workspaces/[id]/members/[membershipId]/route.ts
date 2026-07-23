import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPlatformApi } from "@/lib/platform-api-handler";
import { isPlatformAdminEmail } from "@/lib/env";
import { track } from "@/lib/analytics";
import { invalidateWorkspaceAccess } from "@/lib/access-control";
import { recordAudit } from "@/lib/audit-log";
import { auditContextFromHeaders } from "@/lib/audit";

/**
 * Platform-only member removal: drop a user from any company. Cross-tenant - the
 * membership must belong to the path workspace (404 otherwise, so existence isn't
 * leaked). Mirrors the last-admin guard from /api/team/[id] and audits the action
 * like the rest of the control plane.
 */
export const DELETE = withPlatformApi<undefined, { id: string; membershipId: string }>(
  {},
  async ({ session, params, req }) => {
    const membership = await prisma.workspaceMembership.findUnique({
      where: { id: params.membershipId },
      select: { id: true, workspaceId: true, userId: true, role: true, user: { select: { email: true } } },
    });

    if (!membership || membership.workspaceId !== params.id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // The main admin (a platform super-admin, per the PLATFORM_ADMIN_EMAILS
    // allow-list) cannot be removed from any workspace.
    if (isPlatformAdminEmail(membership.user.email)) {
      return NextResponse.json(
        { error: "Cannot remove a platform administrator." },
        { status: 400 },
      );
    }

    if (membership.role === "admin") {
      const adminCount = await prisma.workspaceMembership.count({
        where: { workspaceId: params.id, role: "admin" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin of the workspace." },
          { status: 400 },
        );
      }
    }

    await prisma.workspaceMembership.delete({ where: { id: membership.id } });
    // Revoke the removed member's cached API access immediately (don't wait for
    // the revalidation TTL) on this instance.
    invalidateWorkspaceAccess(membership.userId, membership.workspaceId);

    track({
      event: "member.removed",
      workspaceId: params.id,
      userId: session.userId,
      source: "web",
      props: { via: "platform", removedUserId: membership.userId },
    });
    const ctx = auditContextFromHeaders(req.headers);
    await recordAudit({
      action: "member.removed",
      actor: { userId: session.userId, email: session.email, workspaceId: params.id },
      targetType: "user",
      targetId: membership.userId,
      metadata: { via: "platform", targetEmail: membership.user.email, role: membership.role },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return NextResponse.json({ success: "Member removed from the workspace." });
  },
);
