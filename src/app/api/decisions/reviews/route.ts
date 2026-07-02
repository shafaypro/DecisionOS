import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyDecisionWatchers } from "@/lib/notify-watchers";
import { withApi } from "@/lib/api-handler";
import { sameWorkspace } from "@/lib/tenant";
import { ReviewWriteSchema, type ReviewWriteInput } from "@/lib/schemas";

export const POST = withApi<ReviewWriteInput>(
  { require: "writer", schema: ReviewWriteSchema },
  async ({ session, body }) => {
    const { decisionId, outcomeStatus, summary, lessonsLearned, followUpAction } = body;
    const decision = sameWorkspace(
      await prisma.decision.findUnique({ where: { id: decisionId } }),
      session,
    );
    if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });

    await prisma.$transaction([
      prisma.decisionReview.create({
        data: {
          decisionId,
          reviewedByUserId: session.userId,
          outcomeStatus,
          summary: summary?.trim() || null,
          lessonsLearned: lessonsLearned?.trim() || null,
          followUpAction: followUpAction?.trim() || null,
        },
      }),
      prisma.decision.update({
        where: { id: decisionId },
        data: { reviewedAt: new Date(), outcomeStatus },
      }),
      prisma.decisionEvent.create({
        data: { decisionId, userId: session.userId, eventType: "reviewed", newValueJson: JSON.stringify({ outcomeStatus }) },
      }),
    ]);

    await notifyDecisionWatchers({
      decisionId,
      actorUserId: session.userId,
      actorName: session.name,
      event: "reviewed",
      summary: `Reviewed, outcome: ${outcomeStatus}`,
    });

    return NextResponse.json({ success: true });
  },
);
