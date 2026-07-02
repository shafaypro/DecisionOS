import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { ActionItemWriteSchema, type ActionItemWriteInput } from "@/lib/schemas";
import { logger } from "@/lib/logger";

const itemInclude = {
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  decision: { select: { id: true, title: true } },
} as const;

export const GET = withApi(
  { require: "auth" },
  async ({ session, req }) => {
    const { searchParams } = new URL(req.url);
    const assigneeId = searchParams.get("assigneeId");
    const decisionId = searchParams.get("decisionId");
    const status = searchParams.get("status");
    const myItems = searchParams.get("mine") === "true";

    const where: Record<string, unknown> = { workspaceId: session.workspaceId };
    if (assigneeId) where.assigneeId = assigneeId;
    if (myItems) where.assigneeId = session.userId;
    if (decisionId) where.decisionId = decisionId;
    if (status) where.status = status;

    const items = await prisma.actionItem.findMany({
      where,
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { createdAt: "asc" }],
      include: itemInclude,
    });

    return NextResponse.json({ items });
  },
);

export const POST = withApi<ActionItemWriteInput>(
  { require: "writer", schema: ActionItemWriteSchema },
  async ({ session, body }) => {
    // Verify decision belongs to workspace if provided
    if (body.decisionId) {
      const dec = await prisma.decision.findUnique({ where: { id: body.decisionId }, select: { workspaceId: true } });
      if (!dec || dec.workspaceId !== session.workspaceId)
        return NextResponse.json({ error: "Decision not found." }, { status: 404 });
    }

    const item = await prisma.actionItem.create({
      data: {
        workspaceId: session.workspaceId,
        createdById: session.userId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        decisionId: body.decisionId || null,
        assigneeId: body.assigneeId || null,
        priority: body.priority || "medium",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
      include: itemInclude,
    });

    // Notify assignee if different from creator. Best-effort: a notification
    // failure must not roll back (or 500) a successfully-created action item.
    if (item.assigneeId && item.assigneeId !== session.userId) {
      try {
        await prisma.inAppNotification.create({
          data: {
            userId: item.assigneeId,
            workspaceId: session.workspaceId,
            type: "assigned",
            title: "You were assigned an action item",
            body: item.title,
            linkUrl: item.decisionId ? `/decisions/${item.decisionId}` : "/board",
          },
        });
      } catch (err) {
        logger.error("action-item assignee notification failed", { itemId: item.id, err });
      }
    }

    return NextResponse.json({ success: true, item });
  },
);
