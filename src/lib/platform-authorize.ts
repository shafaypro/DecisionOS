/**
 * Platform (provider) authorization - pure, no I/O, so the platform route
 * wrapper stays testable alongside the workspace `authorizeRole`.
 *
 * Platform privilege is orthogonal to the workspace role (admin | member |
 * viewer): a person can be a workspace admin AND a platform super-admin, or
 * either alone. Keeping this separate from `authorizeRole` means the existing
 * workspace authorization (and its tenancy guarantees) is never touched.
 */

import { isPlatformAdmin } from "./auth-guards";

export type PlatformAuthzResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

/** Decide whether a session may act on the platform control plane. Pure. */
export function authorizePlatform(
  session: { platformRole?: string } | null | undefined,
): PlatformAuthzResult {
  if (!session) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }
  if (!isPlatformAdmin(session.platformRole)) {
    return { ok: false, status: 403, error: "Platform admin access required." };
  }
  return { ok: true };
}
