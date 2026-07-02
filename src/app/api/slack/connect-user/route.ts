import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * POST /api/slack/connect-user
 * Links the current DecisionOS user to a Slack user within the configured
 * Slack workspace. Only allowed if the Slack workspace is connected to the
 * same DecisionOS workspace the user belongs to.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const slackUserId = String(form.get("slackUserId") ?? "");
  const slackWorkspaceId = String(form.get("slackWorkspaceId") ?? "");

  if (!slackUserId || !slackWorkspaceId) {
    return NextResponse.json({ error: "Missing slackUserId/slackWorkspaceId" }, { status: 400 });
  }

  const slackLink = await prisma.slackWorkspaceLink.findUnique({ where: { slackWorkspaceId } });
  if (!slackLink || slackLink.decisionWorkspaceId !== session.workspaceId) {
    return NextResponse.json({ error: "Slack workspace not linked to your DecisionOS workspace" }, { status: 403 });
  }

  await prisma.slackUserLink.upsert({
    where: { decisionUserId: session.userId },
    update: { slackUserId, slackWorkspaceId },
    create: { decisionUserId: session.userId, slackUserId, slackWorkspaceId },
  });

  return NextResponse.redirect(new URL("/slack/connect?connected=1", req.url), 303);
}
