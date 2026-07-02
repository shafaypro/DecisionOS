/**
 * Signed magic-link tokens for one-click review responses via email.
 *
 * Token payload: { decisionId, userId, action }
 * Signed with SESSION_SECRET, valid for 7 days.
 * Verified at /api/decisions/review-action?token=...
 */

import { SignJWT, jwtVerify } from "jose";
import { getSessionKey } from "./env";

const encodedKey = getSessionKey();

export type ReviewAction = "valid" | "changed";

export interface ReviewTokenPayload {
  decisionId: string;
  userId: string;
  action: ReviewAction;
}

export async function signReviewToken(payload: ReviewTokenPayload): Promise<string> {
  return new SignJWT({ ...payload, type: "review_magic" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function verifyReviewToken(token: string): Promise<ReviewTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    if (payload.type !== "review_magic") return null;
    return {
      decisionId: payload.decisionId as string,
      userId: payload.userId as string,
      action: payload.action as ReviewAction,
    };
  } catch {
    return null;
  }
}
