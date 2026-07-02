import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { getSessionKey } from "@/lib/env";
import { slackOauthV2Exchange } from "@/lib/slack/client";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { track } from "@/lib/analytics";

interface StatePayload {
  workspaceId: string;
  userId: string;
  type: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  if (errParam) {
    return NextResponse.redirect(
      new URL(`/settings/integrations?slack_error=${encodeURIComponent(errParam)}`, req.url)
    );
  }
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code/state" }, { status: 400 });
  }

  // Verify state JWT
  let payload: StatePayload;
  try {
    const secret = getSessionKey();
    const { payload: p } = await jwtVerify(state, secret, { algorithms: ["HS256"] });
    payload = p as unknown as StatePayload;
    if (payload.type !== "slack_install") throw new Error("bad type");
  } catch {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Slack credentials not configured" }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const redirectUri = `${base}/api/slack/oauth/callback`;

  const oauth = await slackOauthV2Exchange({ code, clientId, clientSecret, redirectUri });
  if (!oauth.ok || !oauth.access_token || !oauth.team?.id) {
    return NextResponse.json(
      { error: "Slack OAuth failed", detail: oauth.error ?? "unknown" },
      { status: 400 }
    );
  }

  const encryptedBotToken = encrypt(oauth.access_token);

  // Upsert - allow reinstall to refresh the token
  await prisma.slackWorkspaceLink.upsert({
    where: { decisionWorkspaceId: payload.workspaceId },
    update: {
      slackWorkspaceId: oauth.team.id,
      slackTeamName: oauth.team.name ?? null,
      slackBotUserId: oauth.bot_user_id ?? null,
      slackBotToken: encryptedBotToken,
      installedByUserId: payload.userId,
      isActive: true,
    },
    create: {
      decisionWorkspaceId: payload.workspaceId,
      slackWorkspaceId: oauth.team.id,
      slackTeamName: oauth.team.name ?? null,
      slackBotUserId: oauth.bot_user_id ?? null,
      slackBotToken: encryptedBotToken,
      installedByUserId: payload.userId,
      isActive: true,
    },
  });

  // Auto-link the installing user's Slack ID → DecisionOS user
  if (oauth.authed_user?.id) {
    await prisma.slackUserLink.upsert({
      where: { decisionUserId: payload.userId },
      update: { slackUserId: oauth.authed_user.id, slackWorkspaceId: oauth.team.id },
      create: {
        decisionUserId: payload.userId,
        slackUserId: oauth.authed_user.id,
        slackWorkspaceId: oauth.team.id,
      },
    });
  }

  track({
    event: "slack.installed",
    workspaceId: payload.workspaceId,
    userId: payload.userId,
    props: { slackTeam: oauth.team.id },
  });

  return NextResponse.redirect(new URL("/settings/integrations?slack=installed", req.url));
}
