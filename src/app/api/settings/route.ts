import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { WorkspaceSettingsSchema, type WorkspaceSettingsInput } from "@/lib/schemas";
import { auditApiEvent } from "@/lib/audit-log";

export const PUT = withApi<WorkspaceSettingsInput>(
  { require: "admin", schema: WorkspaceSettingsSchema },
  async ({ session, body, req }) => {
    const { name, slug } = body;

    const existing = await prisma.workspace.findFirst({
      where: { slug, NOT: { id: session.workspaceId } },
    });
    if (existing) return NextResponse.json({ error: "This slug is already taken" }, { status: 400 });

    await prisma.workspace.update({
      where: { id: session.workspaceId },
      data: { name, slug },
    });

    await auditApiEvent({
      action: "workspace.updated",
      session,
      req,
      targetType: "workspace",
      targetId: session.workspaceId,
      metadata: { name, slug },
    });

    return NextResponse.json({ success: "Workspace updated successfully" });
  },
);
