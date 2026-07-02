/**
 * Lightweight request-scoped context carrier.
 *
 * Uses Node's AsyncLocalStorage to propagate a correlation ID (requestId) and
 * session identifiers through every async call in a single request - no prop
 * drilling, no globals. The logger picks this up automatically so every log
 * line carries the same requestId, making cross-service debugging tractable.
 *
 * Usage in a route handler:
 *   withRequestContext({ requestId, userId, workspaceId }, async () => {
 *     // logger.info() calls here automatically include the context
 *   });
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type RequestContext = {
  requestId: string;
  userId?: string;
  workspaceId?: string;
  startedAt: number;
};

const storage = new AsyncLocalStorage<RequestContext>();

/** Run `fn` inside a request-scoped context. */
export function withRequestContext<T>(
  ctx: Omit<RequestContext, "startedAt">,
  fn: () => T
): T {
  return storage.run({ ...ctx, startedAt: Date.now() }, fn);
}

/** Return the context for the current request, or undefined outside a request. */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Return the requestId for the current request, generating a fallback if none. */
export function getRequestId(): string {
  return storage.getStore()?.requestId ?? randomUUID();
}

/** How long the current request has been running, in ms. */
export function getRequestDurationMs(): number | undefined {
  const ctx = storage.getStore();
  return ctx ? Date.now() - ctx.startedAt : undefined;
}
