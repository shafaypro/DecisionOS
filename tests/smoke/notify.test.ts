import { assert, assertEqual } from "./run";
import {
  isWebhookChannel,
  sendWebhookMessage,
  sendTeamsWebhook,
  sendDiscordWebhook,
} from "../../src/lib/notify";

/**
 * Outbound webhook senders. The channel-specific payload shapes are
 * regression-prone (Teams needs an Adaptive Card, not Slack's `{text}`; Discord
 * caps at 2000 chars), and the error/timeout mapping is a support-load concern.
 * We stub global fetch so nothing leaves the box.
 */

type FetchCall = { url: string; body: unknown };
const realFetch = globalThis.fetch;

/** Install a fetch stub that records calls and returns the given response. */
function stubFetch(responder: () => Promise<Response> | Response) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return responder();
  }) as typeof fetch;
  return calls;
}
function restoreFetch() {
  globalThis.fetch = realFetch;
}

const ok = () => new Response("ok", { status: 200 });

export const notifyTests = {
  "isWebhookChannel recognizes webhook channels only"() {
    assert(isWebhookChannel("slack"));
    assert(isWebhookChannel("teams"));
    assert(isWebhookChannel("discord"));
    assert(isWebhookChannel("webhook"));
    assert(!isWebhookChannel("email"));
    assert(!isWebhookChannel("anthropic"));
    assert(!isWebhookChannel("carrier-pigeon"));
  },

  async "slack dispatch posts a {text} payload"() {
    const calls = stubFetch(ok);
    try {
      await sendWebhookMessage("slack", "https://hooks.slack/x", "hello");
      assertEqual(calls.length, 1);
      assertEqual((calls[0].body as { text: string }).text, "hello");
    } finally {
      restoreFetch();
    }
  },

  async "teams dispatch posts an Adaptive Card, not {text}"() {
    const calls = stubFetch(ok);
    try {
      await sendTeamsWebhook("https://teams/x", "hello");
      const body = calls[0].body as { type: string; attachments: { contentType: string; content: { body: { text: string }[] } }[] };
      assertEqual(body.type, "message");
      assert(body.attachments[0].contentType.includes("adaptive"), "must be an adaptive card");
      assertEqual(body.attachments[0].content.body[0].text, "hello");
      assert(!("text" in (calls[0].body as object)), "Teams must not use Slack's top-level text");
    } finally {
      restoreFetch();
    }
  },

  async "discord truncates content at 2000 characters"() {
    const calls = stubFetch(ok);
    try {
      await sendDiscordWebhook("https://discord/x", "a".repeat(5000));
      assertEqual((calls[0].body as { content: string }).content.length, 2000);
    } finally {
      restoreFetch();
    }
  },

  async "a non-2xx response throws with the channel label"() {
    stubFetch(() => new Response("nope", { status: 500 }));
    try {
      let threw = false;
      try {
        await sendWebhookMessage("slack", "https://hooks.slack/x", "hi");
      } catch (err) {
        threw = true;
        assert((err as Error).message.includes("Slack"), "error should name the channel");
        assert((err as Error).message.includes("500"), "error should include the status");
      }
      assert(threw, "a 500 response must reject");
    } finally {
      restoreFetch();
    }
  },

  async "an aborted request maps to a timeout error"() {
    globalThis.fetch = (async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }) as typeof fetch;
    try {
      let msg = "";
      try {
        await sendWebhookMessage("discord", "https://discord/x", "hi");
      } catch (err) {
        msg = (err as Error).message;
      }
      assert(msg.includes("timed out"), `expected a timeout message, got: ${msg}`);
    } finally {
      restoreFetch();
    }
  },
};
