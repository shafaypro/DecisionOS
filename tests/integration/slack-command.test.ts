/**
 * Integration tests for the Slack slash-command route
 * (src/app/api/slack/commands/log).
 *
 * Security guarantee: a request without a valid Slack signature is rejected
 * (401) before any workspace lookup. Behavioural guarantees: an installed +
 * linked user opens the capture modal; an un-installed workspace or unlinked
 * user gets a helpful ephemeral reply instead of an error.
 *
 * The Slack Web API client is mocked so the test never makes a network call;
 * we assert on whether `slackOpenView` was invoked.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createHmac } from "crypto";

const slackClient = vi.hoisted(() => ({ openView: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/slack/client", () => ({
  slackOpenView: slackClient.openView,
}));

import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { POST as commandPOST } from "@/app/api/slack/commands/log/route";

const SIGNING_SECRET = "slack-signing-secret-integration";
const MARK = `slk${Date.now()}`;
const INSTALLED_TEAM = `T_installed_${MARK}`;
const UNINSTALLED_TEAM = `T_none_${MARK}`;
const LINKED_SLACK_USER = `U_linked_${MARK}`;
const UNLINKED_SLACK_USER = `U_unlinked_${MARK}`;

function signedSlackRequest(form: Record<string, string>, opts?: { secret?: string; ts?: number }): Request {
  const rawBody = new URLSearchParams(form).toString();
  const ts = String(opts?.ts ?? Math.floor(Date.now() / 1000));
  const secret = opts?.secret ?? SIGNING_SECRET;
  const sig = "v0=" + createHmac("sha256", secret).update(`v0:${ts}:${rawBody}`).digest("hex");
  return new Request("http://localhost/api/slack/commands/log", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-signature": sig,
      "x-slack-request-timestamp": ts,
    },
    body: rawBody,
  });
}

beforeAll(async () => {
  process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;

  const ws = await prisma.workspace.create({ data: { name: "Slack WS", slug: `slk-ws-${MARK}` } });
  const installer = await prisma.user.create({
    data: { name: "installer", email: `installer-${MARK}@t.test`, passwordHash: "x" },
  });
  const linkedUser = await prisma.user.create({
    data: { name: "linked", email: `linked-${MARK}@t.test`, passwordHash: "x" },
  });

  await prisma.slackWorkspaceLink.create({
    data: {
      decisionWorkspaceId: ws.id,
      slackWorkspaceId: INSTALLED_TEAM,
      slackTeamName: "Acme",
      slackBotToken: encrypt("xoxb-test-token"),
      installedByUserId: installer.id,
      isActive: true,
    },
  });
  await prisma.slackUserLink.create({
    data: { decisionUserId: linkedUser.id, slackUserId: LINKED_SLACK_USER, slackWorkspaceId: INSTALLED_TEAM },
  });
});

afterAll(async () => {
  await prisma.slackWorkspaceLink.deleteMany({ where: { slackWorkspaceId: { in: [INSTALLED_TEAM, UNINSTALLED_TEAM] } } });
  await prisma.slackUserLink.deleteMany({ where: { slackWorkspaceId: INSTALLED_TEAM } });
  await prisma.user.deleteMany({ where: { email: { contains: MARK } } });
  await prisma.workspace.deleteMany({ where: { slug: { startsWith: `slk-ws-${MARK}` } } });
});

describe("Slack slash-command signature gate", () => {
  it("rejects a request with an invalid signature (401)", async () => {
    const req = signedSlackRequest(
      { team_id: INSTALLED_TEAM, trigger_id: "tr1", user_id: LINKED_SLACK_USER, channel_id: "C1", text: "hi" },
      { secret: "wrong-secret" },
    );
    const res = await commandPOST(req);
    expect(res.status).toBe(401);
    expect(slackClient.openView).not.toHaveBeenCalled();
  });

  it("rejects a replayed (stale) timestamp (401)", async () => {
    const req = signedSlackRequest(
      { team_id: INSTALLED_TEAM, trigger_id: "tr1", user_id: LINKED_SLACK_USER, channel_id: "C1", text: "hi" },
      { ts: Math.floor(Date.now() / 1000) - 600 },
    );
    const res = await commandPOST(req);
    expect(res.status).toBe(401);
  });
});

describe("Slack slash-command behaviour (valid signatures)", () => {
  it("tells the user to install when the workspace is not linked", async () => {
    const req = signedSlackRequest({
      team_id: UNINSTALLED_TEAM,
      trigger_id: "tr1",
      user_id: LINKED_SLACK_USER,
      channel_id: "C1",
      text: "hi",
    });
    const res = await commandPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.response_type).toBe("ephemeral");
    expect(String(body.text)).toMatch(/isn't installed/i);
    expect(slackClient.openView).not.toHaveBeenCalled();
  });

  it("prompts an unlinked user to connect their account", async () => {
    const req = signedSlackRequest({
      team_id: INSTALLED_TEAM,
      trigger_id: "tr1",
      user_id: UNLINKED_SLACK_USER,
      channel_id: "C1",
      text: "hi",
    });
    const res = await commandPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.response_type).toBe("ephemeral");
    expect(String(body.text)).toMatch(/link your decisionos account/i);
    expect(slackClient.openView).not.toHaveBeenCalled();
  });

  it("opens the capture modal for an installed + linked user", async () => {
    slackClient.openView.mockClear();
    const req = signedSlackRequest({
      team_id: INSTALLED_TEAM,
      trigger_id: "trigger-xyz",
      user_id: LINKED_SLACK_USER,
      channel_id: "C42",
      text: "Adopt Postgres",
    });
    const res = await commandPOST(req);
    expect(res.status).toBe(200);
    // Empty 200 body so Slack just closes the command.
    expect(await res.text()).toBe("");
    expect(slackClient.openView).toHaveBeenCalledTimes(1);
    const [token, triggerId] = slackClient.openView.mock.calls[0];
    expect(token).toBe("xoxb-test-token"); // decrypted bot token
    expect(triggerId).toBe("trigger-xyz");
  });
});
