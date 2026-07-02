import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { sameWorkspace } from "@/lib/tenant";
import {
  TagWriteSchema,
  type TagWriteInput,
  TagDeleteSchema,
  type TagDeleteInput,
} from "@/lib/schemas";

export const POST = withApi<TagWriteInput>(
  { require: "admin", schema: TagWriteSchema },
  async ({ session, body }) => {
    const name = body.name.trim();
    const color = body.color || "#6366f1";

    const existing = await prisma.tag.findUnique({
      where: { workspaceId_name: { workspaceId: session.workspaceId, name } },
    });
    if (existing) return NextResponse.json({ error: "A tag with that name already exists." }, { status: 400 });

    await prisma.tag.create({
      data: { workspaceId: session.workspaceId, name, color },
    });

    return NextResponse.json({ success: true });
  },
);

export const DELETE = withApi<TagDeleteInput>(
  { require: "admin", schema: TagDeleteSchema },
  async ({ session, body }) => {
    const tag = sameWorkspace(
      await prisma.tag.findUnique({ where: { id: body.tagId } }),
      session,
    );
    if (!tag) return NextResponse.json({ error: "Tag not found." }, { status: 404 });

    await prisma.tag.delete({ where: { id: tag.id } });
    return NextResponse.json({ success: true });
  },
);
