/**
 * Session sealing/opening - pure crypto, no I/O.
 *
 * Sessions are *encrypted* (JWE, `dir` + A256GCM), not merely signed: the cookie
 * payload (userId, workspaceId, role, email, name) is confidential at rest in the
 * browser, and tamper-evident. Kept free of `server-only`, `next/headers`, and
 * Node-only crypto so it is edge-runtime safe (used by `proxy.ts`) and unit
 * testable (smoke tests import this directly).
 */

import { EncryptJWT, jwtDecrypt } from "jose";
import { getSessionSecret } from "./env";

export type SessionPayload = {
  userId: string;
  workspaceId: string;
  role: string;
  email: string;
  name: string;
  expiresAt: Date;
  /**
   * Platform (provider) privilege - orthogonal to the workspace `role`. Present
   * only for DecisionOS staff (sourced from the PLATFORM_ADMIN_EMAILS allow-list
   * at login, never self-granted via the DB). Gates the `/admin` console.
   */
  platformRole?: "superadmin";
  /**
   * The platform admin's *own* workspace. While "entered" into another company
   * (impersonation), `workspaceId` points at the target and this preserves the
   * way back. Equals `workspaceId` when not impersonating.
   */
  platformHomeWorkspaceId?: string;
};

/**
 * A256GCM `dir` requires a 32-byte key. Derive it from SESSION_SECRET using only
 * Web-standard APIs (TextEncoder) so this runs on the edge runtime. The env
 * guard enforces SESSION_SECRET length >= 32, so ASCII secrets yield >= 32 bytes;
 * we take the first 32 (and zero-pad the dev-only short fallback defensively).
 */
function deriveKey(secret: string): Uint8Array {
  const bytes = new TextEncoder().encode(secret);
  const key = new Uint8Array(32);
  key.set(bytes.subarray(0, 32));
  return key;
}

const key = deriveKey(getSessionSecret());

/** Encrypt a session payload into a compact JWE string. */
export async function sealSession(payload: SessionPayload): Promise<string> {
  return new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .encrypt(key);
}

/** Decrypt and verify a session JWE. Returns null on any failure. */
export async function openSession(token: string | undefined = ""): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, key);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
