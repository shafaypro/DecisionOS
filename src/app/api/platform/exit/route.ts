import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPlatformApi } from "@/lib/platform-api-handler";
import { createSession } from "@/lib/session";
import { recordAudit } from "@/lib/audit-log";
import { auditContextFromHeaders } from "@/lib/audit";

/**
 * Stop impersonating - return the platform admin to their own workspace. The
 * home workspace was stashed on the session when they entered a company; their
 * real role there is read back from their membership (defaulting to admin, since
 * platform staff own their workspace).
 */
export const POST = withPlatformApi({}, async ({ session, req }) => {
  const homeWorkspaceId = session.platformHomeWorkspaceId ?? session.workspaceId;

  // If they were impersonating (current workspace != home), record leaving it -
  // under that workspace, so it brackets the "entered" event for the customer.
  if (session.workspaceId !== homeWorkspaceId) {
    const ctx = auditContextFromHeaders(req.headers);
    await recordAudit({
      action: "platform.workspace_exited",
      actor: { userId: session.userId, email: session.email, workspaceId: session.workspaceId },
      targetType: "workspace",
      targetId: session.workspaceId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  const membership = await prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId: homeWorkspaceId, userId: session.userId } },
    select: { role: true },
  });

  await createSession({
    userId: session.userId,
    workspaceId: homeWorkspaceId,
    role: membership?.role ?? "admin",
    email: session.email,
    name: session.name,
    platformRole: "superadmin",
    platformHomeWorkspaceId: homeWorkspaceId,
  });

  return NextResponse.json({ ok: true });
});
