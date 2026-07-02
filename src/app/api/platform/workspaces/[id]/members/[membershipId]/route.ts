import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPlatformApi } from "@/lib/platform-api-handler";
import { isPlatformAdminEmail } from "@/lib/env";
import { track } from "@/lib/analytics";

/**
 * Platform-only member removal: drop a user from any company. Cross-tenant - the
 * membership must belong to the path workspace (404 otherwise, so existence isn't
 * leaked). Mirrors the last-admin guard from /api/team/[id] and audits the action
 * like the rest of the control plane.
 */
export const DELETE = withPlatformApi<undefined, { id: string; membershipId: string }>(
  {},
  async ({ session, params }) => {
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

    track({
      event: "member.removed",
      workspaceId: params.id,
      userId: session.userId,
      source: "web",
      props: { via: "platform", removedUserId: membership.userId },
    });

    return NextResponse.json({ success: "Member removed from the workspace." });
  },
);
