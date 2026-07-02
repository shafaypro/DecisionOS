import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { sameWorkspace, type TenantSession } from "@/lib/tenant";
import {
  RelationCreateSchema, RelationDeleteSchema,
  type RelationCreateInput, type RelationDeleteInput,
} from "@/lib/schemas";

type Params = { id: string };

function findDecisionWs(id: string, session: TenantSession) {
  return prisma.decision
    .findUnique({ where: { id }, select: { id: true, workspaceId: true } })
    .then((d) => sameWorkspace(d, session));
}

export const GET = withApi<undefined, Params>({ require: "auth" }, async ({ session, params }) => {
  if (!(await findDecisionWs(params.id, session)))
    return NextResponse.json({ error: "Decision not found." }, { status: 404 });

  const [fromRelations, toRelations] = await Promise.all([
    prisma.decisionRelation.findMany({
      where: { fromDecisionId: params.id },
      include: { toDecision: { select: { id: true, title: true, status: true, category: true } } },
    }),
    prisma.decisionRelation.findMany({
      where: { toDecisionId: params.id },
      include: { fromDecision: { select: { id: true, title: true, status: true, category: true } } },
    }),
  ]);

  return NextResponse.json({ fromRelations, toRelations });
});

export const POST = withApi<RelationCreateInput, Params>(
  { require: "writer", schema: RelationCreateSchema },
  async ({ session, body, params }) => {
    const { id } = params;
    const { toDecisionId, relationType } = body;
    if (toDecisionId === id)
      return NextResponse.json({ error: "A decision cannot relate to itself." }, { status: 400 });

    const [from, to] = await Promise.all([
      prisma.decision.findUnique({ where: { id }, select: { workspaceId: true } }),
      prisma.decision.findUnique({ where: { id: toDecisionId }, select: { workspaceId: true } }),
    ]);
    if (!sameWorkspace(from, session))
      return NextResponse.json({ error: "Decision not found." }, { status: 404 });
    if (!sameWorkspace(to, session))
      return NextResponse.json({ error: "Target decision not found or not in workspace." }, { status: 404 });

    try {
      await prisma.decisionRelation.create({
        data: { fromDecisionId: id, toDecisionId, relationType, createdByUserId: session.userId },
      });
    } catch {
      return NextResponse.json({ error: "This relation already exists." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  },
);

export const DELETE = withApi<RelationDeleteInput, Params>(
  { require: "writer", schema: RelationDeleteSchema },
  async ({ session, body, params }) => {
    const { id } = params;
    const relation = await prisma.decisionRelation.findUnique({
      where: { id: body.relationId },
      include: { fromDecision: { select: { workspaceId: true } } },
    });
    if (
      !relation ||
      relation.fromDecision.workspaceId !== session.workspaceId ||
      (relation.fromDecisionId !== id && relation.toDecisionId !== id)
    )
      return NextResponse.json({ error: "Relation not found." }, { status: 404 });
    if (relation.createdByUserId !== session.userId && session.role !== "admin")
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    await prisma.decisionRelation.delete({ where: { id: body.relationId } });
    return NextResponse.json({ success: true });
  },
);
