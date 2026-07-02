import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { bulkOperationLimiter, mutationKey } from "@/lib/rate-limit";
import { BulkSchema, type BulkInput } from "@/lib/schemas";

export const POST = withApi<BulkInput>(
  { require: "writer", schema: BulkSchema },
  async ({ session, body }) => {
    const limit = await bulkOperationLimiter.check(mutationKey(session));
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many bulk operations. Please wait a moment." },
        { status: 429, headers: limit.headers },
      );
    }

    const { action, ids } = body;

    // Verify every id belongs to the caller's workspace.
    const decisions = await prisma.decision.findMany({
      where: { id: { in: ids }, workspaceId: session.workspaceId },
      select: {
        id: true, title: true, status: true, category: true, impactLevel: true,
        summary: true, problemStatement: true, chosenOption: true, rationale: true,
        alternativesConsidered: true, assumptions: true, risks: true,
        decisionDate: true, reviewDate: true, visibility: true, createdAt: true, updatedAt: true,
      },
    });

    const foundIds = new Set(decisions.map((d) => d.id));
    if (ids.some((id) => !foundIds.has(id)))
      return NextResponse.json({ error: "Some decisions were not found or not in your workspace." }, { status: 404 });

    if (action === "archive") {
      await prisma.decision.updateMany({
        where: { id: { in: ids }, workspaceId: session.workspaceId },
        data: { status: "archived" },
      });
      await Promise.all(
        decisions
          .filter((d) => d.status !== "archived")
          .map((d) =>
            prisma.decisionEvent.create({
              data: {
                decisionId: d.id,
                userId: session.userId,
                eventType: "status_changed",
                oldValueJson: JSON.stringify({ status: d.status }),
                newValueJson: JSON.stringify({ status: "archived" }),
              },
            }),
          ),
      );
      return NextResponse.json({ success: true, affected: ids.length });
    }

    // action === "export" (Zod enum guarantees this is the only other value)
    return NextResponse.json({ success: true, decisions });
  },
);
