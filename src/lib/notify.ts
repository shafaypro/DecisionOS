/**
 * Outbound webhook senders for workspace notification integrations.
 *
 * Each channel is an "incoming webhook" the workspace admin pastes into Settings →
 * Integrations. We POST a channel-appropriate JSON payload with a hard timeout so a
 * slow/hung endpoint can't stall the request. Used by the WorkspaceIntegration
 * delivery path (src/app/api/notifications/send).
 */

const WEBHOOK_TIMEOUT_MS = 8000;

/** Webhook-based channels - all configured with a single `webhookUrl`. */
export const WEBHOOK_CHANNELS = ["slack", "teams", "discord", "webhook"] as const;
export type WebhookChannel = (typeof WEBHOOK_CHANNELS)[number];

/** Every integration type the app understands (webhook channels + email + AI). */
export const INTEGRATION_TYPES = [...WEBHOOK_CHANNELS, "email", "anthropic"] as const;
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export function isWebhookChannel(type: string): type is WebhookChannel {
  return (WEBHOOK_CHANNELS as readonly string[]).includes(type);
}

async function postJson(url: string, payload: unknown, label: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${label} webhook error: ${res.status}`);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`${label} webhook timed out after ${WEBHOOK_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Slack Incoming Webhook - simple `{ text }` payload. */
export function sendSlackWebhook(webhookUrl: string, text: string): Promise<void> {
  return postJson(webhookUrl, { text }, "Slack");
}

/**
 * Microsoft Teams incoming webhook (Power Automate "Workflows"). These expect an
 * Adaptive Card wrapped in a message attachment - NOT Slack's `{ text }` shape,
 * which silently fails. (Legacy O365 connector "MessageCard" webhooks are being
 * retired by Microsoft, so we target the current Workflows format.)
 */
export function sendTeamsWebhook(webhookUrl: string, text: string): Promise<void> {
  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.4",
          body: [{ type: "TextBlock", text, wrap: true }],
        },
      },
    ],
  };
  return postJson(webhookUrl, payload, "Teams");
}

/** Discord webhook - `{ content }`, capped at Discord's 2000-char limit. */
export function sendDiscordWebhook(webhookUrl: string, text: string): Promise<void> {
  return postJson(webhookUrl, { content: text.slice(0, 2000) }, "Discord");
}

/** Generic webhook (Zapier/Make/custom) - posts `{ text }` to any HTTPS endpoint. */
export function sendGenericWebhook(webhookUrl: string, text: string): Promise<void> {
  return postJson(webhookUrl, { text }, "Webhook");
}

/** Dispatch to the right sender for a webhook channel. */
export function sendWebhookMessage(channel: WebhookChannel, webhookUrl: string, text: string): Promise<void> {
  switch (channel) {
    case "slack":
      return sendSlackWebhook(webhookUrl, text);
    case "teams":
      return sendTeamsWebhook(webhookUrl, text);
    case "discord":
      return sendDiscordWebhook(webhookUrl, text);
    case "webhook":
      return sendGenericWebhook(webhookUrl, text);
  }
}
