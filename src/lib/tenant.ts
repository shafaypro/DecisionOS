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

/**
 * Guard a fetched decision is one the caller may see: in their workspace, and
 * either workspace-visible or their own private decision. The per-row twin of
 * `decisionVisibilityWhere` - use it wherever a route looks a decision up by id
 * before reading or writing anything that belongs to it. Returns null (→ 404)
 * otherwise, so a private decision's existence isn't confirmed either.
 */
export function visibleDecision<T extends { workspaceId: string; visibility: string; createdByUserId: string }>(
  row: T | null | undefined,
  session: TenantSession,
): T | null {
  if (!row || row.workspaceId !== session.workspaceId) return null;
  return row.visibility === "workspace" || row.createdByUserId === session.userId ? row : null;
}

/**
 * Action items the caller may see: unattached ones, and ones attached to a
 * decision they can see. Without this, the board would show the titles of
 * other members' private decisions next to their follow-ups.
 */
export function actionItemVisibilityWhere(session: TenantSession) {
  return {
    workspaceId: session.workspaceId,
    OR: [
      { decisionId: null },
      { decision: { OR: [{ visibility: "workspace" }, { createdByUserId: session.userId }] } },
    ],
  };
}
