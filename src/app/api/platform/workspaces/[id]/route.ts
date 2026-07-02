import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPlatformApi } from "@/lib/platform-api-handler";
import { PlatformWorkspaceUpdateSchema, type PlatformWorkspaceUpdateInput } from "@/lib/schemas";
import { track } from "@/lib/analytics";
import { recordAudit } from "@/lib/audit-log";
import { auditContextFromHeaders } from "@/lib/audit";

/**
 * Platform-only company management: rename and suspend / reactivate. Each action
 * is recorded in both the analytics event log and the immutable audit trail
 * (under the target workspace, so the customer can see the change).
 */
export const PATCH = withPlatformApi<PlatformWorkspaceUpdateInput, { id: string }>(
  { schema: PlatformWorkspaceUpdateSchema },
  async ({ session, body, params, req }) => {
    const existing = await prisma.workspace.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (body.slug !== undefined) {
      const taken = await prisma.workspace.findFirst({
        where: { slug: body.slug, NOT: { id: params.id } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json({ error: "This slug is already taken" }, { status: 400 });
      }
    }

    const data: { name?: string; slug?: string; status?: string } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.slug !== undefined) data.slug = body.slug;
    if (body.status !== undefined) data.status = body.status;

    const workspace = await prisma.workspace.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, slug: true, status: true },
    });

    const ctx = auditContextFromHeaders(req.headers);
    const auditActor = { userId: session.userId, email: session.email, workspaceId: workspace.id };

    if (body.name !== undefined || body.slug !== undefined) {
      track({
        event: "platform.workspace_renamed",
        workspaceId: workspace.id,
        userId: session.userId,
        source: "web",
        props: { name: workspace.name, slug: workspace.slug },
      });
      await recordAudit({
        action: "platform.workspace_renamed",
        actor: auditActor,
        targetType: "workspace",
        targetId: workspace.id,
        metadata: { name: workspace.name, slug: workspace.slug },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }
    if (body.status !== undefined) {
      track({
        event: "platform.workspace_suspended",
        workspaceId: workspace.id,
        userId: session.userId,
        source: "web",
        props: { status: workspace.status },
      });
      await recordAudit({
        action: "platform.workspace_suspended",
        actor: auditActor,
        targetType: "workspace",
        targetId: workspace.id,
        metadata: { status: workspace.status },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }

    return NextResponse.json({ workspace });
  },
);
