import { NextResponse } from "next/server";
import { verifySlackSignature, readRawBody } from "@/lib/slack/verify";
import { getSlackLinkByTeam, getLinkedDecisionUser } from "@/lib/slack/workspace";
import { slackOpenView } from "@/lib/slack/client";
import { buildLogDecisionModal } from "@/lib/slack/modal";
import { logger } from "@/lib/logger";

/**
 * POST /api/slack/commands/log
 * Slack slash command: /decisionos log [title...]
 *
 * Must respond within 3 seconds, so we:
 *   1. verify signature
 *   2. look up workspace + linked user
 *   3. open a modal via trigger_id
 *   4. return 200 (empty) so Slack doesn't display anything extra
 */
export async function POST(req: Request) {
  const rawBody = await readRawBody(req);
  const signature = req.headers.get("x-slack-signature");
  const timestamp = req.headers.get("x-slack-request-timestamp");

  if (!verifySlackSignature({ rawBody, signature, timestamp })) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const teamId = params.get("team_id") ?? "";
  const triggerId = params.get("trigger_id") ?? "";
  const slackUserId = params.get("user_id") ?? "";
  const channelId = params.get("channel_id") ?? "";
  const text = (params.get("text") ?? "").trim();

  const workspace = await getSlackLinkByTeam(teamId);
  if (!workspace) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "DecisionOS isn't installed for this Slack workspace yet. Ask an admin to install it from Settings → Integrations.",
    });
  }

  const decisionUserId = await getLinkedDecisionUser(slackUserId, teamId);
  if (!decisionUserId) {
    const connectUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/slack/connect?slack_user=${slackUserId}&team=${teamId}`;
    return NextResponse.json({
      response_type: "ephemeral",
      text: `First time using DecisionOS from Slack? <${connectUrl}|Link your DecisionOS account> so we can log decisions as you.`,
    });
  }

  // Open modal. Note: trigger_id is valid for ~3s - we must fire-and-forget.
  const view = buildLogDecisionModal({
    privateMetadata: {
      channelId,
      capturedVia: "slack_slash",
    },
    prefill: text ? { title: text } : undefined,
  });

  // Fire async; don't await - but we need to catch errors so the runtime doesn't log noise.
  slackOpenView(workspace.botToken, triggerId, view).catch((e) => logger.error("slack views.open failed", { err: e }));

  // Respond 200 with empty body so Slack just closes the command.
  return new NextResponse("", { status: 200 });
}
