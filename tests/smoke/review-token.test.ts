import { assert, assertEqual } from "./run";
import { signReviewToken, verifyReviewToken } from "../../src/lib/review-token";
import { SignJWT } from "jose";
import { getSessionKey } from "../../src/lib/env";

/**
 * Magic-link review tokens grant write access via email - a forged or
 * mis-typed token must never satisfy verifyReviewToken().
 */
export const reviewTokenTests = {
  async "signs and verifies a round-trip token"() {
    const token = await signReviewToken({
      decisionId: "dec_123",
      userId: "user_abc",
      action: "valid",
    });
    const payload = await verifyReviewToken(token);
    assert(payload !== null, "token should verify");
    assertEqual(payload!.decisionId, "dec_123");
    assertEqual(payload!.userId, "user_abc");
    assertEqual(payload!.action, "valid");
  },

  async "preserves the action enum exactly"() {
    const t = await signReviewToken({ decisionId: "d1", userId: "u1", action: "changed" });
    const p = await verifyReviewToken(t);
    assertEqual(p!.action, "changed");
  },

  async "rejects garbage"() {
    assertEqual(await verifyReviewToken("not-a-jwt"), null);
    assertEqual(await verifyReviewToken(""), null);
    assertEqual(await verifyReviewToken("eyJ.invalid.payload"), null);
  },

  async "rejects a JWT signed with a different secret"() {
    // Sign with a foreign key - same algorithm, different bytes.
    const foreign = new TextEncoder().encode("x".repeat(64));
    const forged = await new SignJWT({
      decisionId: "d1",
      userId: "u1",
      action: "valid",
      type: "review_magic",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(foreign);
    assertEqual(await verifyReviewToken(forged), null);
  },

  async "rejects a JWT with the wrong `type` claim"() {
    // Same key, valid JWT, but type is something else - must be rejected so
    // that a session JWT can never be re-purposed as a review action.
    const key = getSessionKey();
    const t = await new SignJWT({
      decisionId: "d1",
      userId: "u1",
      action: "valid",
      type: "session", // wrong intent
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(key);
    assertEqual(await verifyReviewToken(t), null);
  },

  async "rejects an expired token"() {
    const key = getSessionKey();
    // setExpirationTime() with an absolute past timestamp guarantees the
    // token is already expired regardless of the runner's clock.
    const expired = await new SignJWT({
      decisionId: "d1",
      userId: "u1",
      action: "valid",
      type: "review_magic",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    assertEqual(await verifyReviewToken(expired), null);
  },
};
