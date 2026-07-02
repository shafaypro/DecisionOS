/**
 * Centralized, validated environment configuration.
 *
 * Every security-sensitive `process.env` read goes through here so there is ONE
 * place that enforces "must be set in production" and never ships a predictable
 * fallback secret to a real deployment. Previously the SESSION_SECRET fallback
 * string was duplicated across seven files - a deploy that forgot the env var
 * got forgeable session JWTs and predictable AES keys.
 *
 * Validation is lazy + cached: importing this module never throws (so `next
 * build` and client-bundle tree-shaking stay safe); the throw happens the first
 * time a secret is actually requested at runtime.
 */

const isProd = process.env.NODE_ENV === "production";

/**
 * Clearly-labeled dev-only default. NEVER returned when NODE_ENV === "production"
 * - getSessionSecret() throws instead. Length is kept ≥ 32 so dev behaves like prod.
 */
const DEV_SESSION_SECRET = "dev-only-insecure-session-secret-change-me";

let cachedSecret: string | undefined;

/**
 * The secret used to sign session/review JWTs and derive AES-256-GCM keys for
 * stored integration secrets. Required (≥ 32 chars) in production.
 */
export function getSessionSecret(): string {
  if (cachedSecret) return cachedSecret;

  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) {
    cachedSecret = secret;
    return cachedSecret;
  }

  if (isProd) {
    throw new Error(
      "SESSION_SECRET is required in production and must be at least 32 characters. " +
        "Generate one with `openssl rand -hex 32` and set it in the environment."
    );
  }

  if (secret) {
    console.warn("[env] SESSION_SECRET is shorter than 32 chars - using it anyway (dev only).");
    cachedSecret = secret;
  } else {
    console.warn("[env] SESSION_SECRET is not set - using an insecure dev default. Never use this in production.");
    cachedSecret = DEV_SESSION_SECRET;
  }
  return cachedSecret;
}

/** Encoded form of the session secret, for `jose` SignJWT/jwtVerify. */
export function getSessionKey(): Uint8Array {
  return new TextEncoder().encode(getSessionSecret());
}

/**
 * The database connection string. Required in production; defaults to the local
 * SQLite file in dev. The Postgres-vs-libsql adapter choice lives in prisma.ts.
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (isProd) {
    throw new Error("DATABASE_URL is required in production (e.g. postgres://… for a managed Postgres).");
  }
  return "file:./prisma/dev.db";
}

/**
 * Authorize a request to the unauthenticated `/api/cron/*` endpoints (review
 * reminders, weekly digest). These fan out email + Slack DMs to every workspace,
 * so an open endpoint is an abuse/spam vector.
 *
 * `CRON_SECRET` guards them via `Authorization: Bearer <secret>`. The important
 * rule is the production case: a *missing* secret locks the endpoint (returns
 * false) rather than opening it. Previously an unset secret silently allowed any
 * caller in prod - a misconfiguration that read as "wide open". In dev an unset
 * secret stays permissive so the routes can be exercised locally without setup.
 *
 * @param authHeader raw `Authorization` header value, e.g. "Bearer abc123"
 */
export function isAuthorizedCron(authHeader: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Missing secret: locked in prod (misconfig must not mean "open"), allowed in dev.
    // Read NODE_ENV at call time, not the import-time constant, so the rule holds
    // regardless of when this module was first loaded.
    return process.env.NODE_ENV !== "production";
  }
  return authHeader === `Bearer ${secret}`;
}

/**
 * Platform super-admin allow-list (comma-separated emails in PLATFORM_ADMIN_EMAILS).
 *
 * This is the *source of truth* for who is DecisionOS staff: it's evaluated at
 * login and stamped into the session, so platform privilege can never be granted
 * by a database write (a compromised workspace admin, SQL injection, or a rogue
 * member can't escalate). Like CRON_SECRET, it fails closed - an unset/empty var
 * means there are simply no platform admins.
 */
export function getPlatformAdminEmails(): string[] {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True when `email` is on the platform super-admin allow-list (case-insensitive). */
export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getPlatformAdminEmails().includes(email.trim().toLowerCase());
}

export const isProduction = isProd;
