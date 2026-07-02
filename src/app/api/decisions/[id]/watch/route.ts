import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { sameWorkspace, type TenantSession } from "@/lib/tenant";

/**
 * Watch / unwatch a decision. Watching is a per-user subscription to change
 * notifications (in-app + email) - it doesn't mutate the decision, so any
 * workspace member (including viewers) may watch.
 */

type Params = { id: string };

async function findDecision(id: string, session: TenantSession) {
  return sameWorkspace(
    await prisma.decision.findUnique({ where: { id }, select: { id: true, workspaceId: true } }),
    session,
  );
}

export const POST = withApi<undefined, Params>({ require: "auth" }, async ({ session, params }) => {
  if (!(await findDecision(params.id, session)))
    return NextResponse.json({ error: "Decision not found." }, { status: 404 });

  await prisma.decisionWatcher.upsert({
    where: { decisionId_userId: { decisionId: params.id, userId: session.userId } },
    create: { decisionId: params.id, userId: session.userId, source: "manual" },
    update: {},
  });
  return NextResponse.json({ watching: true });
});

export const DELETE = withApi<undefined, Params>({ require: "auth" }, async ({ session, params }) => {
  if (!(await findDecision(params.id, session)))
    return NextResponse.json({ error: "Decision not found." }, { status: 404 });

  await prisma.decisionWatcher.deleteMany({
    where: { decisionId: params.id, userId: session.userId },
  });
  return NextResponse.json({ watching: false });
});
