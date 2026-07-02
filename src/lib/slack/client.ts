/**
 * Minimal Slack Web API wrapper. Only the methods we need - no SDK dep.
 */

const SLACK_API = "https://slack.com/api";

interface SlackResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

async function call(method: string, token: string, body: Record<string, unknown>): Promise<SlackResponse> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as SlackResponse;
  return json;
}

export async function slackOpenView(
  token: string,
  triggerId: string,
  view: Record<string, unknown>
): Promise<SlackResponse> {
  return call("views.open", token, { trigger_id: triggerId, view });
}

export async function slackPostEphemeral(
  token: string,
  args: { channel: string; user: string; text: string; blocks?: unknown[] }
): Promise<SlackResponse> {
  return call("chat.postEphemeral", token, args);
}

export async function slackPostMessage(
  token: string,
  args: { channel: string; text: string; blocks?: unknown[]; thread_ts?: string }
): Promise<SlackResponse> {
  return call("chat.postMessage", token, args);
}

export async function slackGetPermalink(
  token: string,
  args: { channel: string; message_ts: string }
): Promise<SlackResponse> {
  const url = new URL(`${SLACK_API}/chat.getPermalink`);
  url.searchParams.set("channel", args.channel);
  url.searchParams.set("message_ts", args.message_ts);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()) as SlackResponse;
}

export async function slackUserInfo(token: string, slackUserId: string): Promise<SlackResponse> {
  const url = new URL(`${SLACK_API}/users.info`);
  url.searchParams.set("user", slackUserId);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()) as SlackResponse;
}

/**
 * Open (or reuse) a DM channel with a Slack user. Returns the channel ID.
 */
export async function slackOpenConversation(
  token: string,
  slackUserId: string,
): Promise<{ ok: boolean; channelId?: string; error?: string }> {
  const resp = await call("conversations.open", token, { users: slackUserId });
  if (!resp.ok) return { ok: false, error: resp.error };
  const channel = (resp.channel as { id?: string } | undefined)?.id;
  return { ok: true, channelId: channel };
}

export interface OAuthV2Response extends SlackResponse {
  access_token?: string; // bot token (xoxb-...)
  bot_user_id?: string;
  team?: { id: string; name: string };
  authed_user?: { id: string };
}

/**
 * Exchange OAuth code for a bot token.
 */
export async function slackOauthV2Exchange(args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<OAuthV2Response> {
  const body = new URLSearchParams({
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
  });
  const res = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json()) as OAuthV2Response;
}
