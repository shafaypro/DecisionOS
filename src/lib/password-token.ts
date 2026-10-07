/**
 * Signed, single-use links for setting a password - used both to accept an
 * invitation and to reset a forgotten password.
 *
 * Stateless: the token is a JWT signed with SESSION_SECRET, so there is no
 * token table to clean up. Single use comes from binding the token to a
 * fingerprint of the user's current password hash: setting a new password
 * changes the hash, which invalidates every outstanding link for that user,
 * including the one just used.
 */

import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getSessionKey } from "./env";

export type PasswordTokenPurpose = "invite" | "reset";

/** Invites sit in an inbox for a while; reset links should not. */
const TTL: Record<PasswordTokenPurpose, string> = {
  invite: "7d",
  reset: "1h",
};

const TOKEN_TYPE = "password_set";

/** Short, non-reversible digest of the bcrypt hash - never the hash itself. */
export function passwordFingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 22);
}

export async function signPasswordToken(
  user: { id: string; passwordHash: string },
  purpose: PasswordTokenPurpose,
): Promise<string> {
  return new SignJWT({ type: TOKEN_TYPE, purpose, fp: passwordFingerprint(user.passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(TTL[purpose])
    .sign(getSessionKey());
}

export interface PasswordTokenClaims {
  userId: string;
  purpose: PasswordTokenPurpose;
  fingerprint: string;
}

/** Signature, expiry, and shape only. Callers must still check the fingerprint. */
export async function readPasswordToken(token: string): Promise<PasswordTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionKey(), { algorithms: ["HS256"] });
    if (payload.type !== TOKEN_TYPE || typeof payload.sub !== "string") return null;
    if (payload.purpose !== "invite" && payload.purpose !== "reset") return null;
    if (typeof payload.fp !== "string") return null;
    return { userId: payload.sub, purpose: payload.purpose, fingerprint: payload.fp };
  } catch {
    return null;
  }
}

/** True when the token was minted against the password the user has right now. */
export function tokenMatchesPassword(claims: PasswordTokenClaims, passwordHash: string): boolean {
  return claims.fingerprint === passwordFingerprint(passwordHash);
}
