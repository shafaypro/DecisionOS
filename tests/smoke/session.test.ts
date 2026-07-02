import { sealSession, openSession, type SessionPayload } from "../../src/lib/session-crypto";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const PAYLOAD: SessionPayload = {
  userId: "u_1",
  workspaceId: "w_1",
  role: "admin",
  email: "admin@acme.demo",
  name: "Alex Chen",
  expiresAt: new Date("2030-01-01T00:00:00Z"),
};

export const sessionTests = {
  "round-trips a session payload": async () => {
    const token = await sealSession(PAYLOAD);
    const out = await openSession(token);
    assert(out !== null, "should decrypt");
    assert(out!.userId === "u_1", "userId preserved");
    assert(out!.workspaceId === "w_1", "workspaceId preserved");
    assert(out!.role === "admin", "role preserved");
    assert(out!.email === "admin@acme.demo", "email preserved");
  },

  "produces a compact JWE (5 segments), not a readable JWT": async () => {
    const token = await sealSession(PAYLOAD);
    const parts = token.split(".");
    assert(parts.length === 5, `JWE compact form has 5 segments, got ${parts.length}`);
    // The payload must NOT be recoverable as plaintext JSON (it's encrypted).
    let leaked = false;
    for (const seg of parts) {
      try {
        const decoded = Buffer.from(seg, "base64url").toString("utf8");
        if (decoded.includes("admin@acme.demo") || decoded.includes("workspaceId")) leaked = true;
      } catch {
        /* non-decodable segment is fine */
      }
    }
    assert(!leaked, "session contents must not be readable from the token");
  },

  "rejects an empty / missing token": async () => {
    assert((await openSession("")) === null, "empty → null");
    assert((await openSession(undefined)) === null, "undefined → null");
  },

  "rejects garbage and tampered tokens": async () => {
    assert((await openSession("not-a-jwe")) === null, "garbage → null");
    const token = await sealSession(PAYLOAD);
    const parts = token.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA"); // corrupt ciphertext
    assert((await openSession(parts.join("."))) === null, "tampered ciphertext → null");
  },

  "rejects a plain (unencrypted) JWT-shaped token": async () => {
    // A 3-segment signed-JWT shape must not be accepted by the JWE decryptor.
    const fake = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4In0.sig";
    assert((await openSession(fake)) === null, "signed JWT shape → null");
  },
};
