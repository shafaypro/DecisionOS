/**
 * Multi-tenant scoping helpers.
 *
 * Tenant isolation in DecisionOS is enforced in application code: every query
 * must constrain by `workspaceId`. Centralizing the filters here (instead of
 * hand-writing `{ workspaceId }` in 40+ routes) removes the "forgot the filter"
 * class of cross-tenant leaks and makes the rule unit-testable.
 *
 * Pure functions, no I/O.
 */

export interface TenantSession {
  userId: string;
  workspaceId: string;
}

/** Base workspace filter - use as the `where` (or spread into it) for any
 *  workspace-owned model. */
export function workspaceWhere(session: TenantSession): { workspaceId: string } {
  return { workspaceId: session.workspaceId };
}

/**
 * Workspace filter that also respects per-decision visibility: workspace-visible
 * decisions, plus the caller's own private ones. Use for any decision read that
 * a member could trigger (list, search, ask, share-within-app).
 */
export function decisionVisibilityWhere(session: TenantSession): {
  workspaceId: string;
  OR: ({ visibility: "workspace" } | { createdByUserId: string })[];
} {
  return {
    workspaceId: session.workspaceId,
    OR: [{ visibility: "workspace" }, { createdByUserId: session.userId }],
  };
}

/**
 * Guard a fetched row belongs to the caller's workspace. Returns the row when it
 * matches, otherwise null - callers translate null into 404/403. Prevents acting
 * on an id from another tenant even if a query was under-scoped.
 */
export function sameWorkspace<T extends { workspaceId: string }>(
  row: T | null | undefined,
  session: TenantSession,
): T | null {
  if (!row) return null;
  return row.workspaceId === session.workspaceId ? row : null;
}
