/**
 * Centralized error reporting.
 *
 * Forwards error-level events to Sentry when `SENTRY_DSN` is configured;
 * otherwise it is a no-op and the structured logs remain the only record. It is
 * wired into `logger.error` (see logger.ts), so every error log - including the
 * `withApi` unhandled-error path - is reported through a single integration
 * point with no per-route changes.
 *
 * SECURITY: error payloads routinely carry request context, and context is the
 * easiest place for a credential or PII to leak into a third-party service.
 * Everything that leaves the process is passed through `scrub()` first, which:
 *   - redacts values whose KEY looks like a credential/PII (authorization,
 *     cookie, *token*, *secret*, password, session, api key, signing secret,
 *     stripe/slack signatures, email, …);
 *   - redacts string VALUES that look like bearer tokens or JWTs regardless of
 *     their key;
 *   - truncates long strings and caps object depth / array length so a runaway
 *     object can neither exfiltrate bulk data nor blow the payload budget;
 *   - is cycle-safe (a self-referential object never recurses forever).
 *
 * `scrub()` is a pure function exported for unit testing - it is the security
 * boundary, so it is tested directly.
 *
 * This module must NOT import `logger` (logger imports this) - it uses
 * `console` for its own diagnostics to avoid an import cycle and re-entrancy.
 */

const REDACTED = "[redacted]";
const MAX_STRING = 1_000;
const MAX_DEPTH = 6;
const MAX_ARRAY = 50;
const MAX_KEYS = 100;

/**
 * Keys whose VALUE must never be sent. Matched case-insensitively against the
 * whole key. Kept deliberately broad: a false redaction costs a debugging hint,
 * a false negative leaks a secret to a third party.
 */
const SENSITIVE_KEY =
  /(authorization|cookie|set-cookie|x-slack-signature|slack-signature|stripe-signature|signing[-_ ]?secret|webhook[-_ ]?secret|client[-_ ]?secret|bot[-_ ]?token|access[-_ ]?token|refresh[-_ ]?token|\bsecret\b|\btoken\b|password|passwd|\bpwd\b|session|\bjwt\b|api[-_ ]?key|\bdsn\b|\bemail\b)/i;

/** Bearer header, JWT (x.y.z), or a long opaque token - redact by value. */
const SECRET_VALUE =
  /(bearer\s+[\w.-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+|\b[A-Za-z0-9_-]{40,}\b|xox[abprs]-[\w-]+)/i;

function scrubString(value: string): string {
  if (SECRET_VALUE.test(value)) return REDACTED;
  return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "…[truncated]" : value;
}

function scrubValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;

  if (value instanceof Error) {
    return { name: value.name, message: scrubString(value.message), stack: value.stack };
  }

  if (depth >= MAX_DEPTH) return "[truncated:depth]";

  if (Array.isArray(value)) {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    const out = value.slice(0, MAX_ARRAY).map((v) => scrubValue(v, depth + 1, seen));
    if (value.length > MAX_ARRAY) out.push(`…(${value.length - MAX_ARRAY} more)`);
    return out;
  }

  if (typeof value === "object") {
    if (seen.has(value as object)) return "[circular]";
    seen.add(value as object);
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (count >= MAX_KEYS) {
        out["…"] = "[truncated:keys]";
        break;
      }
      count++;
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : scrubValue(v, depth + 1, seen);
    }
    return out;
  }

  return String(value);
}

/**
 * Recursively redact credentials/PII and bound the size of an arbitrary fields
 * object. Pure: returns a new object and never mutates the input. The security
 * boundary for everything sent to Sentry - unit-tested directly.
 */
export function scrub(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!fields) return {};
  return scrubValue(fields, 0, new WeakSet()) as Record<string, unknown>;
}

type SentryModule = typeof import("@sentry/node");
let sentryPromise: Promise<SentryModule | null> | undefined;

/**
 * Lazily initialize Sentry from `SENTRY_DSN`. The dynamic import keeps the SDK
 * out of bundles where it is unused and degrades to logs-only (never throws) if
 * the package is absent or init fails. Cached so init runs at most once.
 */
function getSentry(): Promise<SentryModule | null> {
  if (sentryPromise) return sentryPromise;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    sentryPromise = Promise.resolve(null);
    return sentryPromise;
  }

  sentryPromise = import("@sentry/node")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        release: process.env.SENTRY_RELEASE,
        // We use Sentry for errors, not performance - no transaction sampling.
        tracesSampleRate: 0,
        // Never let the SDK attach cookies/IPs/headers on its own.
        sendDefaultPii: false,
        beforeSend(event) {
          if (event.extra) event.extra = scrub(event.extra as Record<string, unknown>);
          // Defense in depth: strip request envelopes the SDK may have attached.
          delete event.request;
          delete event.user;
          return event;
        },
      });
      return Sentry;
    })
    .catch((err) => {
      console.warn(
        "[error-reporting] Sentry unavailable, falling back to logs:",
        err instanceof Error ? err.message : String(err),
      );
      return null;
    });

  return sentryPromise;
}

function pickError(fields?: Record<string, unknown>): Error | undefined {
  if (!fields) return undefined;
  for (const v of Object.values(fields)) if (v instanceof Error) return v;
  return undefined;
}

/**
 * Report an error-level event. Fire-and-forget and exception-safe: a reporting
 * failure must never escalate into a request failure. Called by `logger.error`;
 * also safe to call directly.
 */
export function reportError(message: string, fields?: Record<string, unknown>): void {
  try {
    const extra = scrub(fields);
    const error = pickError(fields);
    void getSentry().then((Sentry) => {
      if (!Sentry) return;
      try {
        if (error) {
          Sentry.captureException(error, { extra: { message, ...extra } });
        } else {
          Sentry.captureMessage(message, { level: "error", extra });
        }
      } catch {
        /* never throw from reporting */
      }
    });
  } catch {
    /* never throw from reporting */
  }
}

/** Explicit capture API for a caught exception with optional context. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error));
  reportError(err.message, { ...context, err });
}
