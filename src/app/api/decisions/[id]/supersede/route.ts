import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { sameWorkspace } from "@/lib/tenant";
import { SupersedeSchema, type SupersedeInput } from "@/lib/schemas";
import { notifyDecisionWatchers } from "@/lib/notify-watchers";
import { track } from "@/lib/analytics";

/**
 * POST /api/decisions/[id]/supersede  body: { toDecisionId }
 *
 * Creates a `supersedes` relation from the new decision → this one and flips this
 * decision's status to "superseded", atomically in a transaction.
 */
export const POST = withApi<SupersedeInput, { id: string }>(
  { require: "writer", schema: SupersedeSchema },
  async ({ session, body, params }) => {
    const { id } = params;
    const { toDecisionId } = body;
    if (toDecisionId === id)
      return NextResponse.json({ error: "A decision cannot supersede itself." }, { status: 400 });

    const oldDecision = sameWorkspace(
      await prisma.decision.findUnique({ where: { id }, select: { id: true, workspaceId: true, status: true } }),
      session,
    );
    const newDecision = sameWorkspace(
      await prisma.decision.findUnique({ where: { id: toDecisionId }, select: { id: true, workspaceId: true } }),
      session,
    );
    if (!oldDecision)
      return NextResponse.json({ error: "Decision not found." }, { status: 404 });
    if (!newDecision)
      return NextResponse.json({ error: "Target decision not found or not in your workspace." }, { status: 404 });

    try {
      await prisma.$transaction([
        prisma.decisionRelation.create({
          data: {
            fromDecisionId: toDecisionId,
            toDecisionId: id,
            relationType: "supersedes",
            createdByUserId: session.userId,
          },
        }),
        prisma.decision.update({ where: { id }, data: { status: "superseded" } }),
        prisma.decisionEvent.create({
          data: {
            decisionId: id,
            userId: session.userId,
            eventType: "status_changed",
            oldValueJson: JSON.stringify({ status: oldDecision.status }),
            newValueJson: JSON.stringify({ status: "superseded", supersededBy: toDecisionId }),
          },
        }),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      if (msg.includes("Unique")) {
        return NextResponse.json({ error: "This decision is already marked as superseded by that one." }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to supersede." }, { status: 500 });
    }

    track({
      event: "decision.superseded",
      workspaceId: session.workspaceId,
      userId: session.userId,
      props: { supersededId: id, supersededBy: toDecisionId },
    });

    await notifyDecisionWatchers({
      decisionId: id,
      actorUserId: session.userId,
      actorName: session.name,
      event: "superseded",
      summary: "This decision was superseded by a newer one.",
    });

    return NextResponse.json({ success: true });
  },
);
