import { getSession } from "@/lib/session";
import { getSessionKey } from "@/lib/env";
import { redirect } from "next/navigation";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";

/**
 * GET /api/slack/install
 * Starts the Slack OAuth install flow. Must be called from within DecisionOS
 * (authenticated) so we can tie the Slack workspace to the current DecisionOS
 * workspace. We sign a short-lived state JWT so the callback can't be CSRF'd.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Only workspace admins can install Slack" }, { status: 403 });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "SLACK_CLIENT_ID not configured. Set it in environment to enable Slack install." },
      { status: 500 }
    );
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const redirectUri = `${base}/api/slack/oauth/callback`;

  // Sign state: ties callback back to the installing DecisionOS workspace/user
  const secret = getSessionKey();
  const state = await new SignJWT({
    workspaceId: session.workspaceId,
    userId: session.userId,
    type: "slack_install",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);

  // Slack bot scopes needed for capture bot
  const scopes = [
    "commands",
    "chat:write",
    "users:read",
    "users:read.email",
    "reactions:read",
    "channels:history",
    "groups:history",
    "im:history",
    "mpim:history",
  ].join(",");

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
