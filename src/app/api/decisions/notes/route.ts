import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyDecisionWatchers } from "@/lib/notify-watchers";
import { withApi } from "@/lib/api-handler";
import { sameWorkspace } from "@/lib/tenant";
import { NoteWriteSchema, NoteDeleteSchema, type NoteWriteInput, type NoteDeleteInput } from "@/lib/schemas";

export const POST = withApi<NoteWriteInput>(
  { require: "writer", schema: NoteWriteSchema },
  async ({ session, body }) => {
    const { decisionId, content } = body;
    const decision = sameWorkspace(
      await prisma.decision.findUnique({ where: { id: decisionId } }),
      session,
    );
    if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });

    await prisma.$transaction([
      prisma.decisionNote.create({ data: { decisionId, userId: session.userId, content } }),
      prisma.decisionEvent.create({ data: { decisionId, userId: session.userId, eventType: "note_added" } }),
    ]);

    await notifyDecisionWatchers({
      decisionId,
      actorUserId: session.userId,
      actorName: session.name,
      event: "note_added",
      summary: content.length > 140 ? `${content.slice(0, 140)}…` : content,
    });

    return NextResponse.json({ success: true });
  },
);

export const DELETE = withApi<NoteDeleteInput>(
  { require: "writer", schema: NoteDeleteSchema },
  async ({ session, body }) => {
    const note = await prisma.decisionNote.findUnique({
      where: { id: body.noteId },
      include: { decision: { select: { workspaceId: true } } },
    });
    if (!note || note.decision.workspaceId !== session.workspaceId)
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    if (note.userId !== session.userId && session.role !== "admin")
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    await prisma.decisionNote.delete({ where: { id: body.noteId } });
    return NextResponse.json({ success: true });
  },
);
