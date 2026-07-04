import { assert, assertEqual } from "./run";
import {
  withRequestContext,
  getRequestContext,
  getRequestId,
  getRequestDurationMs,
} from "../../src/lib/observability";

/**
 * The request-context carrier underpins log correlation - every log line in a
 * request must share one requestId. These assert the AsyncLocalStorage
 * propagation and the "safe outside a request" fallbacks.
 */
export const observabilityTests = {
  "context is undefined outside a request"() {
    assertEqual(getRequestContext(), undefined);
    assertEqual(getRequestDurationMs(), undefined);
  },

  "getRequestId falls back to a fresh UUID with no context"() {
    const id = getRequestId();
    // RFC-4122 v4 shape
    assert(/^[0-9a-f-]{36}$/i.test(id), `expected a uuid, got ${id}`);
    assert(getRequestId() !== id, "each fallback should be unique");
  },

  async "context propagates through nested awaits"() {
    await withRequestContext({ requestId: "req-123", userId: "u1", workspaceId: "w1" }, async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 1));
      const ctx = getRequestContext();
      assert(ctx !== undefined, "context must survive awaits");
      assertEqual(ctx!.requestId, "req-123");
      assertEqual(getRequestId(), "req-123");
      assertEqual(ctx!.userId, "u1");
      assert(typeof getRequestDurationMs() === "number", "duration is measurable inside a request");
    });
  },

  "context does not leak after the run completes"() {
    assertEqual(getRequestContext(), undefined);
  },
};
