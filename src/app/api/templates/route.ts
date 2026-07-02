import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { TemplateWriteSchema, type TemplateWriteInput } from "@/lib/schemas";

export const GET = withApi(
  { require: "auth" },
  async ({ session }) => {
    const templates = await prisma.decisionTemplate.findMany({
      where: { OR: [{ workspaceId: null }, { workspaceId: session.workspaceId }] },
      orderBy: [{ isBuiltIn: "desc" }, { category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ templates });
  },
);

export const POST = withApi<TemplateWriteInput>(
  { require: "admin", schema: TemplateWriteSchema },
  async ({ session, body }) => {
    const template = await prisma.decisionTemplate.create({
      data: {
        workspaceId: session.workspaceId,
        name: body.name.trim(),
        category: body.category,
        description: body.description?.trim() || null,
        defaultValues: JSON.stringify(body.defaultValues ?? {}),
        isBuiltIn: false,
      },
    });

    return NextResponse.json({ success: true, template });
  },
);
