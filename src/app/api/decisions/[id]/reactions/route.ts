import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { sameWorkspace, type TenantSession } from "@/lib/tenant";
import { ReactionSchema, type ReactionInput } from "@/lib/schemas";

/**
 * Emoji reactions on a decision. Toggle semantics: POST with an emoji you've
 * already reacted with removes it; otherwise it adds it. Viewer role can read
 * but cannot toggle. The unique (decisionId, userId, emoji) prevents dupes.
 */

type Params = { id: string };

async function findDecision(id: string, session: TenantSession) {
  return sameWorkspace(
    await prisma.decision.findUnique({ where: { id }, select: { id: true, workspaceId: true } }),
    session,
  );
}

export const GET = withApi<undefined, Params>({ require: "auth" }, async ({ session, params }) => {
  if (!(await findDecision(params.id, session)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.decisionReaction.findMany({
    where: { decisionId: params.id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ reactions: rows });
});

export const POST = withApi<ReactionInput, Params>(
  { require: "writer", schema: ReactionSchema },
  async ({ session, body, params }) => {
    if (!(await findDecision(params.id, session)))
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { emoji } = body;
    const existing = await prisma.decisionReaction.findUnique({
      where: { decisionId_userId_emoji: { decisionId: params.id, userId: session.userId, emoji } },
    });

    if (existing) {
      await prisma.decisionReaction.delete({ where: { id: existing.id } });
      return NextResponse.json({ toggled: "removed", emoji });
    }

    await prisma.decisionReaction.create({
      data: { decisionId: params.id, userId: session.userId, emoji },
    });
    return NextResponse.json({ toggled: "added", emoji });
  },
);
