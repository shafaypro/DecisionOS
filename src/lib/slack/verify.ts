import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies a Slack request's signature per:
 * https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * Call with the raw request body string, Slack's X-Slack-Signature, and
 * X-Slack-Request-Timestamp headers. Rejects requests older than 5 minutes.
 */
export function verifySlackSignature(opts: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  signingSecret?: string;
}): boolean {
  const { rawBody, signature, timestamp } = opts;
  const signingSecret = opts.signingSecret ?? process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret || !signature || !timestamp) return false;

  // Reject replay attempts older than 5 minutes.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false;

  const basestring = `v0:${timestamp}:${rawBody}`;
  const expected = "v0=" + createHmac("sha256", signingSecret).update(basestring).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Reads the raw body from a Next.js Request. Call this BEFORE parsing JSON
 * or form data - the HMAC must be computed over the exact bytes Slack sent.
 */
export async function readRawBody(req: Request): Promise<string> {
  return await req.text();
}
