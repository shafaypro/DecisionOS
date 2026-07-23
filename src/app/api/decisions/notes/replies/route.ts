import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyDecisionWatchers } from "@/lib/notify-watchers";
import { withApi } from "@/lib/api-handler";
import { NoteReplyWriteSchema, ReplyDeleteSchema, type NoteReplyWriteInput, type ReplyDeleteInput } from "@/lib/schemas";

export const POST = withApi<NoteReplyWriteInput>(
  { require: "writer", schema: NoteReplyWriteSchema },
  async ({ session, body }) => {
    const note = await prisma.decisionNote.findUnique({
      where: { id: body.noteId },
      include: { decision: { select: { id: true, workspaceId: true } } },
    });
    if (!note || note.decision.workspaceId !== session.workspaceId)
      return NextResponse.json({ error: "Note not found." }, { status: 404 });

    await prisma.$transaction([
      prisma.noteReply.create({
        data: { noteId: body.noteId, userId: session.userId, content: body.content },
      }),
      prisma.decisionEvent.create({
        data: { decisionId: note.decision.id, userId: session.userId, eventType: "note_replied" },
      }),
    ]);

    await notifyDecisionWatchers({
      decisionId: note.decision.id,
      actorUserId: session.userId,
      actorName: session.name,
      event: "note_replied",
      summary: body.content.length > 140 ? `${body.content.slice(0, 140)}…` : body.content,
    });

    return NextResponse.json({ success: true });
  },
);

export const DELETE = withApi<ReplyDeleteInput>(
  { require: "writer", schema: ReplyDeleteSchema },
  async ({ session, body }) => {
    const reply = await prisma.noteReply.findUnique({
      where: { id: body.replyId },
      include: { note: { include: { decision: { select: { workspaceId: true } } } } },
    });
    if (!reply || reply.note.decision.workspaceId !== session.workspaceId)
      return NextResponse.json({ error: "Reply not found." }, { status: 404 });
    if (reply.userId !== session.userId && session.role !== "admin")
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    await prisma.noteReply.delete({ where: { id: body.replyId } });
    return NextResponse.json({ success: true });
  },
);
