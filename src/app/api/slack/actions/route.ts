import { NextResponse } from "next/server";
import { verifySlackSignature, readRawBody } from "@/lib/slack/verify";
import { getSlackLinkByTeam, getLinkedDecisionUser } from "@/lib/slack/workspace";
import { extractModalValues, buildLogDecisionModal, type PrivateMetadata } from "@/lib/slack/modal";
import { slackPostEphemeral, slackOpenView } from "@/lib/slack/client";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/analytics";
import { logger } from "@/lib/logger";

/**
 * POST /api/slack/actions
 * Slack interactivity endpoint - handles modal submissions, button clicks,
 * select changes. We only handle view_submission for the "log a decision" modal
 * right now.
 */
export async function POST(req: Request) {
  const rawBody = await readRawBody(req);
  const signature = req.headers.get("x-slack-signature");
  const timestamp = req.headers.get("x-slack-request-timestamp");

  if (!verifySlackSignature({ rawBody, signature, timestamp })) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const payloadJson = params.get("payload");
  if (!payloadJson) return new NextResponse("missing payload", { status: 400 });

  const payload = JSON.parse(payloadJson);
  const type = payload.type as string;

  // Block actions - handle button clicks from the events-API interactive message
  if (type === "block_actions") {
    const action = (payload.actions as Array<{ action_id: string; value?: string }>)?.[0];
    if (!action) return new NextResponse("", { status: 200 });

    if (action.action_id === "dismiss_log_decision") {
      // Slack automatically removes the message on ack - nothing to do.
      return new NextResponse("", { status: 200 });
    }

    if (action.action_id === "open_log_decision_modal") {
      const triggerId = payload.trigger_id as string;
      if (!triggerId) return new NextResponse("", { status: 200 });

      const teamId = payload.team?.id ?? "";
      const workspace = await getSlackLinkByTeam(teamId);
      if (!workspace) return new NextResponse("", { status: 200 });

      let sourceMeta: { source_ts?: string; channel?: string; permalink?: string; slack_user_id?: string } = {};
      try { sourceMeta = JSON.parse(action.value ?? "{}"); } catch { /* empty */ }

      const meta: PrivateMetadata = {
        channelId: sourceMeta.channel ?? "",
        messageTs: sourceMeta.source_ts ?? "",
        messagePermalink: sourceMeta.permalink ?? "",
        capturedVia: "slack_emoji",
      };

      const modal = buildLogDecisionModal({ privateMetadata: meta });
      slackOpenView(workspace.botToken, triggerId, modal).catch(() => {});
      return new NextResponse("", { status: 200 });
    }

    return new NextResponse("", { status: 200 });
  }

  if (type !== "view_submission") {
    return new NextResponse("", { status: 200 });
  }

  const callbackId = payload.view?.callback_id;
  if (callbackId !== "decisionos_log_decision") {
    return new NextResponse("", { status: 200 });
  }

  const teamId = payload.team?.id ?? "";
  const slackUserId = payload.user?.id ?? "";
  const workspace = await getSlackLinkByTeam(teamId);
  if (!workspace) {
    return NextResponse.json({
      response_action: "errors",
      errors: { title: "Slack workspace is no longer connected to DecisionOS." },
    });
  }

  const decisionUserId = await getLinkedDecisionUser(slackUserId, teamId);
  if (!decisionUserId) {
    return NextResponse.json({
      response_action: "errors",
      errors: { title: "Link your DecisionOS account first. Run `/decisionos log` for instructions." },
    });
  }

  // Validate
  const values = extractModalValues(payload.view);
  const errors: Record<string, string> = {};
  if (!values.title || values.title.length < 3) errors.title = "Please enter a decision title (3+ chars).";
  if (!values.rationale || values.rationale.length < 10)
    errors.rationale = "Rationale matters. Give future-you at least a sentence.";
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ response_action: "errors", errors });
  }

  const meta: PrivateMetadata = JSON.parse(payload.view.private_metadata || "{}");

  // Create the decision
  const decision = await prisma.decision.create({
    data: {
      workspaceId: workspace.link.decisionWorkspaceId,
      createdByUserId: decisionUserId,
      ownerUserId: decisionUserId,
      title: values.title,
      rationale: values.rationale,
      chosenOption: values.chosenOption,
      status: values.status,
      reviewDate: values.reviewDate,
      decisionDate: new Date(),
      capturedVia: meta.capturedVia ?? "slack_slash",
    },
  });

  // Save Slack source link if we captured from a message
  if (meta.messagePermalink) {
    await prisma.decisionLink.create({
      data: {
        decisionId: decision.id,
        createdByUserId: decisionUserId,
        label: "Slack thread",
        url: meta.messagePermalink,
        linkType: "slack",
      },
    });
  }

  // Event log
  await prisma.decisionEvent.create({
    data: {
      decisionId: decision.id,
      userId: decisionUserId,
      eventType: "created",
      newValueJson: JSON.stringify({ capturedVia: meta.capturedVia }),
    },
  });

  // Confirm in-channel (ephemeral, only the user sees it)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const decisionUrl = `${appUrl}/decisions/${decision.id}`;
  if (meta.channelId) {
    slackPostEphemeral(workspace.botToken, {
      channel: meta.channelId,
      user: slackUserId,
      text: `✅ Decision logged: *${values.title}*\n<${decisionUrl}|Open in DecisionOS>`,
    }).catch((e) => logger.error("slack postEphemeral failed", { err: e }));
  }

  track({
    event: "slack.capture_completed",
    workspaceId: workspace.link.decisionWorkspaceId,
    userId: decisionUserId,
    source: meta.capturedVia ?? "slack_slash",
    props: { decisionId: decision.id, hasSource: !!meta.messagePermalink },
  });
  track({
    event: "decision.created",
    workspaceId: workspace.link.decisionWorkspaceId,
    userId: decisionUserId,
    source: meta.capturedVia ?? "slack_slash",
    props: { hasRationale: !!decision.rationale, status: decision.status },
  });

  // Close the modal
  return new NextResponse("", { status: 200 });
}
