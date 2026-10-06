import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { auditApiEvent } from "@/lib/audit-log";
import { WorkspaceSharingSchema, type WorkspaceSharingInput } from "@/lib/schemas";

/**
 * PUT /api/settings/sharing
 * Admin-only switch for public read-only links. Turning it off also revokes
 * every existing link, so switching it back on doesn't silently re-publish
 * decisions someone may have stopped expecting to be public.
 */
export const PUT = withApi<WorkspaceSharingInput>(
  { require: "admin", schema: WorkspaceSharingSchema },
  async ({ session, body, req }) => {
    const revoked = await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: session.workspaceId },
        data: { publicSharing: body.publicSharing },
      });
      if (body.publicSharing) return 0;
      const { count } = await tx.decision.updateMany({
        where: { workspaceId: session.workspaceId, shareToken: { not: null } },
        data: { shareToken: null },
      });
      return count;
    });

    await auditApiEvent({
      action: "workspace.updated",
      session,
      req,
      targetType: "workspace",
      targetId: session.workspaceId,
      metadata: { publicSharing: body.publicSharing, revokedLinks: revoked },
    });

    return NextResponse.json({
      success: body.publicSharing
        ? "Public links are on."
        : revoked > 0
        ? `Public links are off. ${revoked} existing link${revoked === 1 ? " was" : "s were"} revoked.`
        : "Public links are off.",
    });
  },
);
