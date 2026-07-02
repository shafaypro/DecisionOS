import "server-only";
import { cookies } from "next/headers";
import { sealSession, openSession, type SessionPayload } from "./session-crypto";

export type { SessionPayload };

// Back-compat aliases - sessions are encrypted (JWE/A256GCM), see session-crypto.
export const encrypt = sealSession;
export const decrypt = openSession;

export async function createSession(payload: Omit<SessionPayload, "expiresAt">) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await sealSession({ ...payload, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    // Secure-by-default in production, but overridable for HTTP-only deployments
    // (e.g. IP-only with no TLS) where a Secure cookie would be dropped by the
    // browser and break the session. Set COOKIE_SECURE=false in those cases.
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");
  if (!sessionCookie) return null;
  return openSession(sessionCookie.value);
}
