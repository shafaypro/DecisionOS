/**
 * Role authorization decisions - pure, no I/O, so route wrappers stay testable.
 *
 * Capability levels:
 *   - "auth"   - any authenticated member (incl. viewer): read-only endpoints.
 *   - "writer" - admin or member (blocks viewer): create/update/delete.
 *   - "admin"  - admin only: workspace settings, integrations, team.
 */

import { isViewer, isAdmin, VIEWER_ERROR } from "./auth-guards";

export type RequireLevel = "auth" | "writer" | "admin";

export type AuthzResult =
  | { ok: true }
  | { ok: false; status: 403; error: string };

/** Decide whether `role` satisfies `require`. Pure. */
export function authorizeRole(role: string, require: RequireLevel): AuthzResult {
  if (require === "writer" && isViewer(role)) {
    return { ok: false, status: 403, error: VIEWER_ERROR.error };
  }
  if (require === "admin" && !isAdmin(role)) {
    return { ok: false, status: 403, error: "Admin access required." };
  }
  return { ok: true };
}
