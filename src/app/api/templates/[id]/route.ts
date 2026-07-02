import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { TemplateWriteSchema, type TemplateWriteInput } from "@/lib/schemas";

export const PUT = withApi<TemplateWriteInput, { id: string }>(
  { require: "admin", schema: TemplateWriteSchema },
  async ({ session, body, params }) => {
    const template = await prisma.decisionTemplate.findUnique({ where: { id: params.id } });
    if (!template || template.workspaceId !== session.workspaceId)
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    if (template.isBuiltIn)
      return NextResponse.json({ error: "Cannot modify built-in templates." }, { status: 403 });

    const updated = await prisma.decisionTemplate.update({
      where: { id: params.id },
      data: {
        name: body.name.trim(),
        category: body.category,
        description: body.description?.trim() || null,
        defaultValues: JSON.stringify(body.defaultValues ?? {}),
      },
    });

    return NextResponse.json({ success: true, template: updated });
  },
);

export const DELETE = withApi<undefined, { id: string }>(
  { require: "admin" },
  async ({ session, params }) => {
    const template = await prisma.decisionTemplate.findUnique({ where: { id: params.id } });
    if (!template || template.workspaceId !== session.workspaceId)
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    if (template.isBuiltIn)
      return NextResponse.json({ error: "Cannot delete built-in templates." }, { status: 403 });

    await prisma.decisionTemplate.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  },
);
