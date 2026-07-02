import { createHmac } from "crypto";
import { verifySlackSignature } from "../../src/lib/slack/verify";

const SECRET = "test-signing-secret";

function sign(rawBody: string, ts: number): string {
  return "v0=" + createHmac("sha256", SECRET).update(`v0:${ts}:${rawBody}`).digest("hex");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export const slackHmacTests = {
  "accepts a fresh, correctly-signed body": () => {
    const body = "token=xxx&team_id=T&command=%2Fdecisionos";
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign(body, ts);
    assert(
      verifySlackSignature({
        rawBody: body,
        signature: sig,
        timestamp: String(ts),
        signingSecret: SECRET,
      }),
      "valid signature should verify",
    );
  },

  "rejects a tampered body": () => {
    const body = "token=xxx&team_id=T";
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign(body, ts);
    assert(
      !verifySlackSignature({
        rawBody: body + "&evil=1",
        signature: sig,
        timestamp: String(ts),
        signingSecret: SECRET,
      }),
      "tampered body must not verify",
    );
  },

  "rejects wrong secret": () => {
    const body = "token=xxx";
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign(body, ts);
    assert(
      !verifySlackSignature({
        rawBody: body,
        signature: sig,
        timestamp: String(ts),
        signingSecret: "wrong-secret",
      }),
      "wrong secret must not verify",
    );
  },

  "rejects replay > 5 minutes old": () => {
    const body = "token=xxx";
    const ts = Math.floor(Date.now() / 1000) - 60 * 6; // 6 min ago
    const sig = sign(body, ts);
    assert(
      !verifySlackSignature({
        rawBody: body,
        signature: sig,
        timestamp: String(ts),
        signingSecret: SECRET,
      }),
      "stale timestamp must not verify",
    );
  },

  "rejects missing signature / timestamp": () => {
    assert(
      !verifySlackSignature({
        rawBody: "x",
        signature: null,
        timestamp: String(Math.floor(Date.now() / 1000)),
        signingSecret: SECRET,
      }),
      "null signature must fail",
    );
    assert(
      !verifySlackSignature({
        rawBody: "x",
        signature: "v0=abc",
        timestamp: null,
        signingSecret: SECRET,
      }),
      "null timestamp must fail",
    );
  },

  "rejects non-numeric timestamp": () => {
    const body = "x";
    const sig = sign(body, 1234567890);
    assert(
      !verifySlackSignature({
        rawBody: body,
        signature: sig,
        timestamp: "not-a-number",
        signingSecret: SECRET,
      }),
      "NaN timestamp must fail",
    );
  },
};
