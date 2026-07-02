import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { sameWorkspace } from "@/lib/tenant";
import { DecisionTagSchema, type DecisionTagInput } from "@/lib/schemas";

export const POST = withApi<DecisionTagInput>(
  { require: "writer", schema: DecisionTagSchema },
  async ({ session, body }) => {
    const { decisionId, tagId } = body;
    const [decision, tag] = await Promise.all([
      prisma.decision.findUnique({ where: { id: decisionId } }),
      prisma.tag.findUnique({ where: { id: tagId } }),
    ]);
    if (!sameWorkspace(decision, session))
      return NextResponse.json({ error: "Decision not found." }, { status: 404 });
    if (!sameWorkspace(tag, session))
      return NextResponse.json({ error: "Tag not found." }, { status: 404 });

    await prisma.decisionTag.upsert({
      where: { decisionId_tagId: { decisionId, tagId } },
      create: { decisionId, tagId },
      update: {},
    });

    return NextResponse.json({ success: true });
  },
);

export const DELETE = withApi<DecisionTagInput>(
  { require: "writer", schema: DecisionTagSchema },
  async ({ session, body }) => {
    const { decisionId, tagId } = body;
    const decision = sameWorkspace(
      await prisma.decision.findUnique({ where: { id: decisionId } }),
      session,
    );
    if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });

    await prisma.decisionTag.deleteMany({ where: { decisionId, tagId } });
    return NextResponse.json({ success: true });
  },
);
