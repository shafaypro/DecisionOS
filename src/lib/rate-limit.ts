/**
 * Rate limiter with a pluggable backend.
 *
 *   - No REDIS_URL  → in-memory fixed window. Correct only for a single instance
 *     (each replica keeps its own counters), fine for local dev.
 *   - REDIS_URL set → Redis fixed-window counter shared across every instance, so
 *     the limit holds behind a load balancer / across serverless invocations.
 *
 * `check()` is async because the Redis backend performs I/O. All call sites await it.
 *
 * Usage:
 *   const rl = rateLimit({ limit: 30, windowMs: 60_000 });
 *   const r = await rl.check(ipKey);
 *   if (!r.ok) return new Response("Too many requests", { status: 429, headers: r.headers });
 */

import { logger } from "./logger";

type Bucket = { count: number; resetAt: number };

const BUCKETS = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  // Sweep expired buckets at most once every 60s so we don't leak memory.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of BUCKETS) {
    if (b.resetAt <= now) BUCKETS.delete(k);
  }
}

export interface RateLimitOptions {
  /** Max requests in window. */
  limit: number;
  /** Window size in ms. */
  windowMs: number;
  /** Optional prefix to namespace buckets when sharing one map. */
  prefix?: string;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  /** Response headers to surface limit state. */
  headers: Record<string, string>;
}

function buildHeaders(limit: number, remaining: number, resetAt: number, ok: boolean, now: number) {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
  if (!ok) {
    headers["Retry-After"] = String(Math.max(1, Math.ceil((resetAt - now) / 1000)));
  }
  return headers;
}

function checkMemory(k: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  let b = BUCKETS.get(k);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    BUCKETS.set(k, b);
  }
  b.count++;
  const remaining = Math.max(0, limit - b.count);
  const ok = b.count <= limit;
  return { ok, remaining, resetAt: b.resetAt, headers: buildHeaders(limit, remaining, b.resetAt, ok, now) };
}

// ── Redis backend (lazy singleton) ──────────────────────────────────────────
// `undefined` = not yet resolved, `null` = unavailable (no URL or no driver).
type RedisLike = {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
};
let redisClient: RedisLike | null | undefined;

function getRedis(): RedisLike | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) {
    redisClient = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require("ioredis");
    redisClient = new Redis(url, { maxRetriesPerRequest: 2 }) as RedisLike;
    logger.info("rate-limit: using Redis backend");
    return redisClient;
  } catch (err) {
    logger.warn("REDIS_URL is set but ioredis is unavailable - falling back to in-memory rate limiting", { err });
    redisClient = null;
    return null;
  }
}

async function checkRedis(
  client: RedisLike,
  k: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  // Fixed-window counter: INCR, and set the TTL on the first hit of the window.
  const count = await client.incr(k);
  if (count === 1) await client.pexpire(k, windowMs);
  let ttl = await client.pttl(k);
  if (ttl < 0) ttl = windowMs; // key existed without TTL (shouldn't happen) - repair on read
  const now = Date.now();
  const resetAt = now + ttl;
  const remaining = Math.max(0, limit - count);
  const ok = count <= limit;
  return { ok, remaining, resetAt, headers: buildHeaders(limit, remaining, resetAt, ok, now) };
}

export function rateLimit(opts: RateLimitOptions) {
  const { limit, windowMs, prefix = "" } = opts;
  return {
    async check(key: string): Promise<RateLimitResult> {
      const k = prefix ? `${prefix}:${key}` : key;
      const client = getRedis();
      if (client) {
        try {
          return await checkRedis(client, `rl:${k}`, limit, windowMs);
        } catch (err) {
          // Never let a Redis hiccup take down the endpoint - degrade to in-memory.
          logger.warn("rate-limit: Redis check failed, falling back to in-memory", { err });
        }
      }
      return checkMemory(k, limit, windowMs);
    },
  };
}

/**
 * Extract a best-effort client key from request headers. Prefers the leftmost
 * x-forwarded-for entry (Vercel/ALB set this), then x-real-ip, then a static
 * fallback (so misconfigured proxies still get limited, just globally).
 */
export function clientKeyFromHeaders(h: { get(name: string): string | null }): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return `ip:${first}`;
  }
  const xri = h.get("x-real-ip");
  if (xri) return `ip:${xri.trim()}`;
  return "ip:unknown";
}

/**
 * Extract a best-effort client key from a Next.js Request. Thin wrapper over
 * clientKeyFromHeaders for call sites that have the full Request.
 */
export function clientKey(req: Request): string {
  return clientKeyFromHeaders(req.headers);
}

// Pre-built limiters for the common cases.
export const publicShareLimiter = rateLimit({
  limit: 60,
  windowMs: 60_000,
  prefix: "share",
});

export const searchLimiter = rateLimit({
  limit: 30,
  windowMs: 60_000,
  prefix: "search",
});

export const ssoStartLimiter = rateLimit({
  limit: 10,
  windowMs: 60_000,
  prefix: "sso",
});

// ── Auth throttling - brute force / credential stuffing / signup spam ─────────
// Keyed per (ip + email) so one attacker can't lock out a whole office, plus a
// coarser per-ip cap to blunt password-spraying many emails from one source.
export const loginLimiter = rateLimit({
  limit: 8,
  windowMs: 10 * 60_000,
  prefix: "auth:login",
});

export const loginIpLimiter = rateLimit({
  limit: 40,
  windowMs: 10 * 60_000,
  prefix: "auth:login-ip",
});

export const signupLimiter = rateLimit({
  limit: 5,
  windowMs: 60 * 60_000,
  prefix: "auth:signup-ip",
});

/**
 * Per-user mutation limiters. Tuned to keep humans well below the cap while
 * still blocking a runaway script that's trying to spam the workspace.
 * Use `mutationKey(session)` for the key so multiple users on the same
 * NAT/office share don't starve each other.
 */
export const decisionMutationLimiter = rateLimit({
  limit: 20,
  windowMs: 60_000,
  prefix: "mut:decision",
});

export const noteMutationLimiter = rateLimit({
  limit: 30,
  windowMs: 60_000,
  prefix: "mut:note",
});

export const actionItemMutationLimiter = rateLimit({
  limit: 30,
  windowMs: 60_000,
  prefix: "mut:action",
});

export const aiDraftLimiter = rateLimit({
  limit: 5,
  windowMs: 60_000,
  prefix: "mut:ai",
});

// "Ask DecisionOS" - interactive Q&A over the decision log. Each call may make
// one model request, so cap it a little above the draft limiter for a chat feel.
export const askLimiter = rateLimit({
  limit: 10,
  windowMs: 60_000,
  prefix: "ask",
});

export const teamInviteLimiter = rateLimit({
  limit: 10,
  windowMs: 60_000,
  prefix: "mut:invite",
});

// Heavier batch operations get a tighter cap - these touch many rows per call.
export const bulkOperationLimiter = rateLimit({
  limit: 5,
  windowMs: 60_000,
  prefix: "mut:bulk",
});

export const exportLimiter = rateLimit({
  limit: 10,
  windowMs: 60_000,
  prefix: "mut:export",
});

/** Build a per-user, per-workspace key for mutation limiters. */
export function mutationKey(session: { userId: string; workspaceId: string }): string {
  return `${session.workspaceId}:${session.userId}`;
}
