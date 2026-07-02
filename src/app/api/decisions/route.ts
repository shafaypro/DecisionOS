import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/analytics";
import { DecisionWriteSchema, type DecisionWriteInput } from "@/lib/schemas";
import { withApi } from "@/lib/api-handler";
import { decisionMutationLimiter, mutationKey } from "@/lib/rate-limit";

export const POST = withApi<DecisionWriteInput>(
  { require: "writer", schema: DecisionWriteSchema },
  async ({ session, body: data }) => {
    const limit = await decisionMutationLimiter.check(mutationKey(session));
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many decisions created. Slow down and try again in a minute." },
        { status: 429, headers: limit.headers },
      );
    }

    const saveAsDraft = data.saveAsDraft === true;
    const status = saveAsDraft ? "draft" : (data.status ?? "draft");

    const consultedIds =
      Array.isArray(data.consultedIds) && data.consultedIds.length > 0
        ? JSON.stringify(data.consultedIds)
        : null;

    const decision = await prisma.decision.create({
      data: {
        workspaceId: session.workspaceId,
        createdByUserId: session.userId,
        ownerUserId: data.ownerUserId ?? null,
        title: data.title,
        summary: data.summary ?? null,
        category: data.category ?? "other",
        status,
        impactLevel: data.impactLevel ?? "medium",
        problemStatement: data.problemStatement ?? null,
        chosenOption: data.chosenOption ?? null,
        rationale: data.rationale ?? null,
        alternativesConsidered: data.alternativesConsidered ?? null,
        assumptions: data.assumptions ?? null,
        risks: data.risks ?? null,
        decisionDate: data.decisionDate ? new Date(data.decisionDate) : null,
        reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
        visibility: data.visibility ?? "workspace",
        capturedVia: "web",
        accountableUserId: data.accountableUserId ?? null,
        consultedIds,
      },
    });

    await prisma.decisionEvent.create({
      data: {
        decisionId: decision.id,
        userId: session.userId,
        eventType: "created",
        newValueJson: JSON.stringify({ title: decision.title, status: decision.status }),
      },
    });

    // Auto-watch: the creator (and owner, if different) follow change
    // notifications by default. They can unwatch from the decision page.
    const watcherSeed = [{ decisionId: decision.id, userId: session.userId, source: "creator" }];
    if (data.ownerUserId && data.ownerUserId !== session.userId) {
      watcherSeed.push({ decisionId: decision.id, userId: data.ownerUserId, source: "owner" });
    }
    await prisma.decisionWatcher.createMany({ data: watcherSeed });

    track({
      event: "decision.created",
      workspaceId: session.workspaceId,
      userId: session.userId,
      props: {
        hasRationale: !!decision.rationale,
        hasReviewDate: !!decision.reviewDate,
        status: decision.status,
      },
    });

    return NextResponse.json({ success: true, id: decision.id });
  },
);
