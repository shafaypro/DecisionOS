import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyDecisionWatchers } from "@/lib/notify-watchers";
import { withApi } from "@/lib/api-handler";
import { sameWorkspace } from "@/lib/tenant";
import { ArchiveSchema, type ArchiveInput } from "@/lib/schemas";

export const POST = withApi<ArchiveInput>(
  { require: "writer", schema: ArchiveSchema },
  async ({ session, body }) => {
    const { decisionId } = body;
    const decision = sameWorkspace(
      await prisma.decision.findUnique({ where: { id: decisionId } }),
      session,
    );
    if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });
    if (decision.createdByUserId !== session.userId && session.role !== "admin")
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    await prisma.$transaction([
      prisma.decision.update({ where: { id: decisionId }, data: { status: "archived" } }),
      prisma.decisionEvent.create({
        data: {
          decisionId,
          userId: session.userId,
          eventType: "status_changed",
          oldValueJson: JSON.stringify({ status: decision.status }),
          newValueJson: JSON.stringify({ status: "archived" }),
        },
      }),
    ]);

    await notifyDecisionWatchers({
      decisionId,
      actorUserId: session.userId,
      actorName: session.name,
      event: "archived",
      summary: "This decision was archived.",
    });

    return NextResponse.json({ success: true });
  },
);
