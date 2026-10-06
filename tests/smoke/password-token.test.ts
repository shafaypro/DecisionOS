import { assert, assertEqual } from "./run";
import { SignJWT } from "jose";
import { getSessionKey } from "../../src/lib/env";
import {
  signPasswordToken,
  readPasswordToken,
  tokenMatchesPassword,
  passwordFingerprint,
} from "../../src/lib/password-token";

/**
 * Set-password links grant control of an account. A link must stop working
 * once it has been used (the password hash changes), must not be forgeable,
 * and must not be mistaken for any other kind of signed token.
 */
const user = { id: "user_1", passwordHash: "$2b$12$abcdefghijklmnopqrstuv" };

export const passwordTokenTests = {
  async "round-trips the user, purpose, and fingerprint"() {
    const claims = await readPasswordToken(await signPasswordToken(user, "invite"));
    assert(claims !== null, "token should verify");
    assertEqual(claims!.userId, "user_1");
    assertEqual(claims!.purpose, "invite");
    assert(tokenMatchesPassword(claims!, user.passwordHash), "fresh token matches the current password");
  },

  async "is single-use: changing the password invalidates it"() {
    const claims = await readPasswordToken(await signPasswordToken(user, "reset"));
    assert(claims !== null, "token should verify");
    assert(!tokenMatchesPassword(claims!, "$2b$12$a-different-hash-entirely"), "stale token must not match");
  },

  "fingerprint is stable and does not contain the hash"() {
    assertEqual(passwordFingerprint(user.passwordHash), passwordFingerprint(user.passwordHash));
    assert(!passwordFingerprint(user.passwordHash).includes("abcdefghij"), "fingerprint must not leak the hash");
  },

  async "rejects a tampered token"() {
    const token = await signPasswordToken(user, "reset");
    const [h, p, sig] = token.split(".");
    const flipped = sig.slice(0, -2) + (sig.endsWith("AA") ? "BB" : "AA");
    assertEqual(await readPasswordToken(`${h}.${p}.${flipped}`), null);
  },

  async "rejects other signed token types (e.g. review magic links)"() {
    const other = await new SignJWT({ type: "review_magic", fp: "x", purpose: "reset" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_1")
      .setExpirationTime("1h")
      .sign(getSessionKey());
    assertEqual(await readPasswordToken(other), null);
  },

  async "rejects an expired token"() {
    const expired = await new SignJWT({ type: "password_set", fp: "x", purpose: "reset" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(getSessionKey());
    assertEqual(await readPasswordToken(expired), null);
  },

  async "rejects garbage"() {
    assertEqual(await readPasswordToken("not-a-token"), null);
    assertEqual(await readPasswordToken(""), null);
  },
};
