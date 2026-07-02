/**
 * Tiny structured logger - zero dependencies.
 *
 * In production it emits one JSON object per line to stdout/stderr so cloud log
 * aggregators (CloudWatch, Cloud Logging, Azure Monitor) can parse fields. In
 * dev it prints a compact human-readable line. Replaces scattered console.* calls
 * so logs carry a level, a message, and structured context.
 *
 * Request context (requestId, userId, workspaceId) is picked up automatically
 * from AsyncLocalStorage via `observability.ts` - no manual threading needed.
 */

import { isProduction } from "./env";
import { getRequestContext } from "./observability";
import { reportError } from "./error-reporting";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): Level {
  const fromEnv = process.env.LOG_LEVEL as Level | undefined;
  if (fromEnv && fromEnv in LEVEL_ORDER) return fromEnv;
  return isProduction ? "info" : "debug";
}

/** Make Error values serializable (JSON.stringify drops message/stack otherwise). */
function normalize(fields?: Fields): Fields | undefined {
  if (!fields) return undefined;
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v;
  }
  return out;
}

function emit(level: Level, message: string, fields?: Fields) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;

  // Enrich with request context - zero cost when outside a request.
  const trace = getRequestContext();
  const traceFields: Fields = trace
    ? { requestId: trace.requestId, userId: trace.userId, workspaceId: trace.workspaceId }
    : {};

  const ctx = { ...traceFields, ...normalize(fields) };
  const sink = level === "error" || level === "warn" ? console.error : console.log;

  if (isProduction) {
    sink(JSON.stringify({ level, message, ...ctx }));
  } else {
    sink(`[${level}] ${message}`, Object.keys(ctx).length ? ctx : "");
  }

  // Forward errors to the error tracker. Pass the original (un-normalized)
  // fields so Sentry receives the real Error for stack grouping; scrubbing
  // happens inside reportError. Fire-and-forget; never throws.
  if (level === "error") {
    reportError(message, { ...traceFields, ...fields });
  }
}

export const logger = {
  debug: (message: string, fields?: Fields) => emit("debug", message, fields),
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
};
