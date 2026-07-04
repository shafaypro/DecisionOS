import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { ActionItemPatchSchema, type ActionItemPatchInput } from "@/lib/schemas";

const itemInclude = {
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  decision: { select: { id: true, title: true } },
} as const;

export const PATCH = withApi<ActionItemPatchInput, { id: string }>(
  { require: "writer", schema: ActionItemPatchSchema },
  async ({ session, params, body }) => {
    const existing = await prisma.actionItem.findUnique({ where: { id: params.id } });
    if (!existing || existing.workspaceId !== session.workspaceId)
      return NextResponse.json({ error: "Action item not found." }, { status: 404 });

    const { title, description, status, priority, assigneeId, dueDate, decisionId } = body;

    // Re-pointing an item to another decision must stay inside the caller's
    // workspace - otherwise a writer could attach an item to a foreign tenant's
    // decision (POST already enforces this; PATCH previously did not).
    if (decisionId) {
      const target = await prisma.decision.findUnique({
        where: { id: decisionId },
        select: { workspaceId: true },
      });
      if (!target || target.workspaceId !== session.workspaceId) {
        return NextResponse.json({ error: "Decision not found." }, { status: 404 });
      }
    }

    const oldAssignee = existing.assigneeId;

    const updated = await prisma.actionItem.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(decisionId !== undefined && { decisionId: decisionId || null }),
      },
      include: itemInclude,
    });

    // Notify new assignee
    if (assigneeId && assigneeId !== oldAssignee && assigneeId !== session.userId) {
      await prisma.inAppNotification.create({
        data: {
          userId: assigneeId,
          workspaceId: session.workspaceId,
          type: "assigned",
          title: "You were assigned an action item",
          body: updated.title,
          linkUrl: updated.decisionId ? `/decisions/${updated.decisionId}` : "/board",
        },
      });
    }

    // Notify creator when item is marked done (if creator ≠ actor)
    if (status === "done" && existing.createdById !== session.userId) {
      await prisma.inAppNotification.create({
        data: {
          userId: existing.createdById,
          workspaceId: session.workspaceId,
          type: "action_done",
          title: "Action item completed",
          body: updated.title,
          linkUrl: updated.decisionId ? `/decisions/${updated.decisionId}` : "/board",
        },
      });
    }

    return NextResponse.json({ success: true, item: updated });
  },
);

export const DELETE = withApi<undefined, { id: string }>(
  { require: "writer" },
  async ({ session, params }) => {
    const item = await prisma.actionItem.findUnique({ where: { id: params.id } });
    if (!item || item.workspaceId !== session.workspaceId)
      return NextResponse.json({ error: "Action item not found." }, { status: 404 });

    if (item.createdById !== session.userId && session.role !== "admin")
      return NextResponse.json({ error: "Only the creator or an admin can delete this item." }, { status: 403 });

    await prisma.actionItem.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  },
);
