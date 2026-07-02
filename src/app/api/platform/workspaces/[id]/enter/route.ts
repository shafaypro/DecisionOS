import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPlatformApi } from "@/lib/platform-api-handler";
import { createSession } from "@/lib/session";
import { track } from "@/lib/analytics";
import { recordAudit } from "@/lib/audit-log";
import { auditContextFromHeaders } from "@/lib/audit";

/**
 * "Enter" a company - re-issue the platform admin's session pointed at the target
 * workspace. Because every workspace-scoped route keys off `session.workspaceId`,
 * this single swap gives the platform admin the full company UI with no per-route
 * changes. `platformRole` is carried through (so they keep /admin access) and the
 * original home workspace is preserved for the way back.
 */
export const POST = withPlatformApi<undefined, { id: string }>({}, async ({ session, params, req }) => {
  const target = await prisma.workspace.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Don't clobber the home workspace if we're already impersonating another one.
  const homeWorkspaceId = session.platformHomeWorkspaceId ?? session.workspaceId;

  await createSession({
    userId: session.userId,
    workspaceId: target.id,
    role: "admin", // platform admin acts with full admin rights inside the company
    email: session.email,
    name: session.name,
    platformRole: "superadmin",
    platformHomeWorkspaceId: homeWorkspaceId,
  });

  track({
    event: "platform.workspace_entered",
    workspaceId: target.id,
    userId: session.userId,
    source: "web",
  });

  // Immutable audit trail, recorded under the TARGET workspace so the customer
  // sees when staff accessed their data (not just our internal analytics).
  const ctx = auditContextFromHeaders(req.headers);
  await recordAudit({
    action: "platform.workspace_entered",
    actor: { userId: session.userId, email: session.email, workspaceId: target.id },
    targetType: "workspace",
    targetId: target.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
});
