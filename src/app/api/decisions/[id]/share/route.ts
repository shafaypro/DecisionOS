import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { decisionVisibilityWhere } from "@/lib/tenant";
import { newShareToken, shareUrl } from "@/lib/share-link";

type Params = { id: string };

async function findVisibleDecision(id: string, session: Parameters<typeof decisionVisibilityWhere>[0]) {
  return prisma.decision.findFirst({
    where: { id, ...decisionVisibilityWhere(session) },
    select: {
      id: true,
      visibility: true,
      shareToken: true,
      workspace: { select: { publicSharing: true } },
    },
  });
}

/**
 * POST /api/decisions/[id]/share
 * Create (or return the existing) public read-only link for a decision.
 * Refused for private decisions and when the workspace has public links off.
 */
export const POST = withApi<undefined, Params>({ require: "writer" }, async ({ session, params }) => {
  const decision = await findVisibleDecision(params.id, session);
  if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });
  if (!decision.workspace.publicSharing) {
    return NextResponse.json(
      { error: "Public links are turned off for this workspace. An admin can turn them on in Settings." },
      { status: 403 },
    );
  }
  if (decision.visibility !== "workspace") {
    return NextResponse.json({ error: "Private decisions can't be shared publicly." }, { status: 400 });
  }

  let token = decision.shareToken;
  if (!token) {
    token = newShareToken();
    await prisma.decision.update({ where: { id: decision.id }, data: { shareToken: token } });
    await prisma.decisionEvent.create({
      data: { decisionId: decision.id, userId: session.userId, eventType: "share_enabled" },
    });
  }
  return NextResponse.json({ url: shareUrl(token) });
});

/**
 * DELETE /api/decisions/[id]/share
 * Revoke the public link. The old URL stops working immediately; sharing again
 * mints a new one.
 */
export const DELETE = withApi<undefined, Params>({ require: "writer" }, async ({ session, params }) => {
  const decision = await findVisibleDecision(params.id, session);
  if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });
  if (decision.shareToken) {
    await prisma.decision.update({ where: { id: decision.id }, data: { shareToken: null } });
    await prisma.decisionEvent.create({
      data: { decisionId: decision.id, userId: session.userId, eventType: "share_revoked" },
    });
  }
  return NextResponse.json({ success: true });
});
