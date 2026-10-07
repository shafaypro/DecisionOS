import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { invalidateWorkspaceAccess } from "@/lib/access-control";
import { isPlatformAdminEmail } from "@/lib/env";
import { track } from "@/lib/analytics";
import { auditApiEvent } from "@/lib/audit-log";
import { TeamRoleSchema, type TeamRoleInput } from "@/lib/schemas";

/**
 * PATCH /api/team/[id]
 * Change a member's role (admin / member / viewer). Admin only, with the same
 * guards as removal: tenant-scoped 404, platform administrators are fixed, and
 * the workspace always keeps at least one admin.
 */
export const PATCH = withApi<TeamRoleInput, { id: string }>(
  { require: "admin", schema: TeamRoleSchema },
  async ({ session, params, body, req }) => {
    const membership = await prisma.workspaceMembership.findUnique({
      where: { id: params.id },
      select: { id: true, workspaceId: true, userId: true, role: true, user: { select: { email: true } } },
    });
    if (!membership || membership.workspaceId !== session.workspaceId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (membership.role === body.role) return NextResponse.json({ success: "No change." });

    if (isPlatformAdminEmail(membership.user.email)) {
      return NextResponse.json({ error: "Cannot change a platform administrator's role." }, { status: 400 });
    }

    if (membership.role === "admin") {
      const adminCount = await prisma.workspaceMembership.count({
        where: { workspaceId: session.workspaceId, role: "admin" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "The workspace needs at least one admin. Promote someone else first." },
          { status: 400 },
        );
      }
    }

    await prisma.workspaceMembership.update({ where: { id: membership.id }, data: { role: body.role } });
    // A demotion takes effect on this instance immediately, not after the TTL.
    invalidateWorkspaceAccess(membership.userId, membership.workspaceId);

    await auditApiEvent({
      action: "member.role_changed",
      session,
      req,
      targetType: "user",
      targetId: membership.userId,
      metadata: { targetEmail: membership.user.email, from: membership.role, to: body.role },
    });

    return NextResponse.json({ success: `Role changed to ${body.role}.` });
  },
);

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
    // Revoke the removed member's cached API access immediately (don't wait for
    // the 30s revalidation TTL) on this instance.
    invalidateWorkspaceAccess(membership.userId, membership.workspaceId);

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
