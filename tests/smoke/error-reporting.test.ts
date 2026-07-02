import { assert, assertEqual } from "./run";
import { scrub } from "../../src/lib/error-reporting";

/**
 * scrub() is the security boundary between request context and a third-party
 * error tracker. A regression here leaks credentials/PII off-box, so every
 * redaction rule is asserted directly. The guiding rule: over-redact rather
 * than under-redact - a lost debugging hint is cheaper than a leaked secret.
 */
const REDACTED = "[redacted]";

export const errorReportingTests = {
  "redacts credential-shaped keys (case-insensitive)"() {
    const out = scrub({
      Authorization: "Bearer abc.def.ghi",
      cookie: "session=xyz",
      apiKey: "k-123",
      Client_Secret: "shh",
      password: "hunter2",
      passwordHash: "$2a$10$abcdefghijklmnop",
      SLACK_SIGNING_SECRET: "deadbeef",
      "stripe-signature": "t=1,v1=ff",
    });
    assertEqual(out.Authorization, REDACTED);
    assertEqual(out.cookie, REDACTED);
    assertEqual(out.apiKey, REDACTED);
    assertEqual(out.Client_Secret, REDACTED);
    assertEqual(out.password, REDACTED);
    assertEqual(out.passwordHash, REDACTED);
    assertEqual(out.SLACK_SIGNING_SECRET, REDACTED);
    assertEqual(out["stripe-signature"], REDACTED);
  },

  "redacts email and session keys"() {
    const out = scrub({ email: "a@b.com", sessionId: "s1", jwt: "x.y.z" });
    assertEqual(out.email, REDACTED);
    assertEqual(out.sessionId, REDACTED);
    assertEqual(out.jwt, REDACTED);
  },

  "redacts secret-shaped string VALUES regardless of key"() {
    const out = scrub({
      note: "Bearer sk_live_1234567890",
      blob: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signaturepart",
      slackToken: "xoxb-12345-67890-abcdefABCDEF",
      opaque: "a".repeat(48),
    });
    assertEqual(out.note, REDACTED);
    assertEqual(out.blob, REDACTED);
    assertEqual(out.slackToken, REDACTED);
    assertEqual(out.opaque, REDACTED);
  },

  "leaves benign fields intact"() {
    const out = scrub({ path: "/api/decisions", method: "POST", status: 500, ok: false });
    assertEqual(out.path, "/api/decisions");
    assertEqual(out.method, "POST");
    assertEqual(out.status, 500);
    assertEqual(out.ok, false);
  },

  "redacts nested objects and arrays"() {
    const out = scrub({
      req: { headers: { authorization: "Bearer t" }, path: "/x" },
      items: [{ token: "abc" }, { name: "fine" }],
    }) as { req: { headers: { authorization: string }; path: string }; items: Array<Record<string, unknown>> };
    assertEqual(out.req.headers.authorization, REDACTED);
    assertEqual(out.req.path, "/x");
    assertEqual(out.items[0].token, REDACTED);
    assertEqual(out.items[1].name, "fine");
  },

  "truncates very long prose strings"() {
    // Real prose (with spaces) is truncated, not redacted - only token-shaped
    // opaque strings trip the secret-value redactor.
    const out = scrub({ summary: ("word ".repeat(1000)).trim() }) as { summary: string };
    assert(out.summary.length < 1100, "long string should be truncated");
    assert(out.summary.endsWith("[truncated]"), "truncation marker expected");
  },

  "caps array length"() {
    const out = scrub({ list: Array.from({ length: 200 }, (_, i) => i) }) as { list: unknown[] };
    assert(out.list.length <= 51, "array should be capped");
    assert(String(out.list[out.list.length - 1]).includes("more"), "overflow marker expected");
  },

  "caps recursion depth"() {
    // 10 levels deep - deeper than MAX_DEPTH (6).
    let deep: Record<string, unknown> = { value: "leaf" };
    for (let i = 0; i < 10; i++) deep = { nested: deep };
    const out = JSON.stringify(scrub({ root: deep }));
    assert(out.includes("truncated:depth"), "deep nesting should be truncated");
  },

  "is cycle-safe (does not infinite-loop)"() {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    const out = JSON.stringify(scrub({ a }));
    assert(out.includes("circular"), "circular ref should be marked, not loop");
  },

  "serializes Error values with a scrubbed message"() {
    const out = scrub({ err: new Error("boom Bearer leaked-token-value-1234567890") }) as {
      err: { name: string; message: string };
    };
    assertEqual(out.err.name, "Error");
    assertEqual(out.err.message, REDACTED);
  },

  "never mutates the input and tolerates undefined"() {
    const input = { token: "secret", keep: "ok" };
    scrub(input);
    assertEqual(input.token, "secret", "input must not be mutated");
    assertEqual(JSON.stringify(scrub(undefined)), "{}");
  },
};
