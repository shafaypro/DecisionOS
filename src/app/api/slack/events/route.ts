import { NextResponse } from "next/server";
import { verifySlackSignature, readRawBody } from "@/lib/slack/verify";
import { getSlackLinkByTeam, getLinkedDecisionUser } from "@/lib/slack/workspace";
import { slackGetPermalink, slackPostEphemeral, slackPostMessage } from "@/lib/slack/client";

/**
 * POST /api/slack/events
 *
 * Handles `reaction_added` events. When the configured trigger emoji fires
 * on a message, we can't open a modal (no trigger_id in Events API). Instead
 * we post an ephemeral interactive message with a "Log Decision" button.
 * Clicking *that* button fires a block_actions payload to /api/slack/actions,
 * which receives a trigger_id and can open the modal immediately - one click
 * from emoji to form, no slash command needed.
 *
 * Flow:
 *   1. User adds :lock: (or configured emoji) to a message
 *   2. Events API fires reaction_added → this handler
 *   3. We post ephemeral interactive message with "Log Decision" button
 *   4. User clicks → block_actions → /api/slack/actions (has trigger_id)
 *   5. /api/slack/actions opens the Log Decision modal
 */
export async function POST(req: Request) {
  const rawBody = await readRawBody(req);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  if (parsed.type === "url_verification") {
    return NextResponse.json({ challenge: parsed.challenge });
  }

  const signature = req.headers.get("x-slack-signature");
  const timestamp = req.headers.get("x-slack-request-timestamp");
  if (!verifySlackSignature({ rawBody, signature, timestamp })) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  if (parsed.type !== "event_callback") {
    return new NextResponse("", { status: 200 });
  }

  const teamId = (parsed.team_id as string) ?? "";
  const event = parsed.event as {
    type: string;
    reaction?: string;
    user?: string;
    item?: { type: string; channel: string; ts: string };
  };

  if (event.type === "reaction_added" && event.item?.type === "message") {
    const workspace = await getSlackLinkByTeam(teamId);
    if (!workspace) return new NextResponse("", { status: 200 });

    const triggerEmoji = workspace.link.triggerEmoji || "lock";
    if (event.reaction !== triggerEmoji) return new NextResponse("", { status: 200 });

    const slackUserId = event.user ?? "";
    if (!slackUserId || slackUserId === workspace.link.slackBotUserId) {
      return new NextResponse("", { status: 200 });
    }

    // Unlinked user → prompt to link account first
    const decisionUserId = await getLinkedDecisionUser(slackUserId, teamId);
    if (!decisionUserId) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const connectUrl = `${baseUrl}/slack/connect?slack_user=${slackUserId}&team=${teamId}`;
      slackPostEphemeral(workspace.botToken, {
        channel: event.item.channel,
        user: slackUserId,
        text: `To log decisions with :${triggerEmoji}:, <${connectUrl}|link your DecisionOS account> first (takes 30 seconds).`,
      }).catch(() => {});
      return new NextResponse("", { status: 200 });
    }

    // Get permalink to the source message so it can be embedded in the decision
    const permalinkRes = await slackGetPermalink(workspace.botToken, {
      channel: event.item.channel,
      message_ts: event.item.ts,
    });
    const permalink = (permalinkRes.permalink as string | undefined) ?? "";

    // Post an ephemeral interactive message. The "Log Decision" button fires a
    // block_actions event that includes a trigger_id - /api/slack/actions then
    // opens the modal. This is the correct pattern for emoji-triggered capture.
    slackPostMessage(workspace.botToken, {
      channel: event.item.channel,
      // thread_ts keeps the prompt in context without cluttering the channel
      thread_ts: event.item.ts,
      text: "Log this as a decision?",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:${triggerEmoji}: *Looks like a decision happened here.* Want to log it in DecisionOS?`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Log Decision", emoji: true },
              style: "primary",
              action_id: "open_log_decision_modal",
              value: JSON.stringify({
                source_ts: event.item.ts,
                channel: event.item.channel,
                permalink,
                slack_user_id: slackUserId,
              }),
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Dismiss", emoji: false },
              action_id: "dismiss_log_decision",
            },
          ],
        },
        ...(permalink
          ? [
              {
                type: "context",
                elements: [
                  {
                    type: "mrkdwn",
                    text: `<${permalink}|View source message>`,
                  },
                ],
              },
            ]
          : []),
      ],
    }).catch(() => {});
  }

  return new NextResponse("", { status: 200 });
}
