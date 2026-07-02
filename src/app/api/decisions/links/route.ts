import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { sameWorkspace } from "@/lib/tenant";
import { LinkWriteSchema, LinkDeleteSchema, type LinkWriteInput, type LinkDeleteInput } from "@/lib/schemas";

export const POST = withApi<LinkWriteInput>(
  { require: "writer", schema: LinkWriteSchema },
  async ({ session, body }) => {
    const { decisionId, label, url, linkType } = body;
    const decision = sameWorkspace(
      await prisma.decision.findUnique({ where: { id: decisionId } }),
      session,
    );
    if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });

    await prisma.decisionLink.create({
      data: { decisionId, label, url, linkType: linkType || "other", createdByUserId: session.userId },
    });
    await prisma.decisionEvent.create({
      data: { decisionId, userId: session.userId, eventType: "link_added", newValueJson: JSON.stringify({ label, url }) },
    });

    return NextResponse.json({ success: true });
  },
);

export const DELETE = withApi<LinkDeleteInput>(
  { require: "writer", schema: LinkDeleteSchema },
  async ({ session, body }) => {
    const link = await prisma.decisionLink.findUnique({
      where: { id: body.linkId },
      include: { decision: { select: { workspaceId: true, createdByUserId: true } } },
    });
    if (!link || link.decision.workspaceId !== session.workspaceId)
      return NextResponse.json({ error: "Link not found." }, { status: 404 });
    if (link.decision.createdByUserId !== session.userId && session.role !== "admin")
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    await prisma.decisionLink.delete({ where: { id: body.linkId } });
    return NextResponse.json({ success: true });
  },
);
