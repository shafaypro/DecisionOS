import "server-only";

import { prisma } from "./prisma";

/**
 * Session revalidation for the API data plane.
 *
 * Every workspace-scoped API route authorizes from the encrypted session cookie,
 * which lives for 7 days. Without a re-check that means:
 *   - a member removed from a workspace keeps full API access until their cookie
 *     expires, and
 *   - a suspended workspace is only locked out in the page layout - the JSON API
 *     stays reachable.
 *
 * This module confirms, on each request, that the session still maps to a live
 * membership in an active workspace. The lookup is cached briefly (per instance)
 * so it stays off the hot path; the cache bounds staleness to `TTL_MS`, and
 * `invalidateWorkspaceAccess` clears an entry immediately on a known change (e.g.
 * a member being removed) for instant revocation on that instance.
 *
 * Note: this enforces membership *existence* and workspace *status*. Role changes
 * (e.g. an admin demoted to member) still take effect on the next login, since
 * authorization keys off the session role; per-request role enforcement is a
 * follow-up.
 */

export type AccessResult =
  | { ok: true; role: string; workspaceStatus: string }
  | { ok: false; status: 401 | 403; error: string };

type CacheEntry = { role: string | null; status: string | null; expiresAt: number };

/** How long a positive/negative access decision is cached, in ms. */
const TTL_MS = 30_000;
/** Hard cap so the cache can't grow without bound; oldest entries are evicted. */
const MAX_ENTRIES = 5_000;

const cache = new Map<string, CacheEntry>();

const keyOf = (userId: string, workspaceId: string) => `${userId}::${workspaceId}`;

async function load(userId: string, workspaceId: string): Promise<CacheEntry> {
  const membership = await prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, workspace: { select: { status: true } } },
  });
  return {
    role: membership?.role ?? null,
    status: membership?.workspace.status ?? null,
    expiresAt: Date.now() + TTL_MS,
  };
}

/**
 * Confirm `userId` is still a member of `workspaceId` and the workspace is active.
 * Returns the (DB) role and status on success, or a ready-to-send 401/403 result.
 */
export async function revalidateWorkspaceAccess(
  userId: string,
  workspaceId: string,
): Promise<AccessResult> {
  const key = keyOf(userId, workspaceId);
  let entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    entry = await load(userId, workspaceId);
    // Map preserves insertion order, so the first key is the oldest.
    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, entry);
  }

  if (entry.role === null) {
    return {
      ok: false,
      status: 401,
      error: "Your access to this workspace is no longer valid. Please sign in again.",
    };
  }
  if (entry.status === "suspended") {
    return { ok: false, status: 403, error: "This workspace is suspended." };
  }
  return { ok: true, role: entry.role, workspaceStatus: entry.status ?? "active" };
}

/** Drop the cached decision for a user+workspace (call after a known change). */
export function invalidateWorkspaceAccess(userId: string, workspaceId: string): void {
  cache.delete(keyOf(userId, workspaceId));
}

/** Test-only: clear the whole cache so suites don't leak state into each other. */
export function __resetAccessCache(): void {
  cache.clear();
}
