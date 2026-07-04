import { assertEqual } from "./run";
import { isAuthorizedCron } from "../../src/lib/env";

/**
 * The /api/cron/* endpoints are unauthenticated routes that fan out email +
 * Slack DMs to every workspace. CRON_SECRET is the only thing standing between a
 * scheduler and an abuse/spam vector, so the authorization rule must hold under
 * every env permutation - especially the "secret missing in production" case,
 * which must LOCK the endpoint rather than open it.
 */
function withEnv(env: { CRON_SECRET?: string; NODE_ENV?: string }, fn: () => void) {
  // Next augments process.env.NODE_ENV as a readonly union; this test needs to
  // toggle it, so write through a mutable view of the same object.
  const mutableEnv = process.env as Record<string, string | undefined>;
  const prevSecret = process.env.CRON_SECRET;
  const prevNodeEnv = process.env.NODE_ENV;
  try {
    if (env.CRON_SECRET === undefined) delete mutableEnv.CRON_SECRET;
    else mutableEnv.CRON_SECRET = env.CRON_SECRET;
    if (env.NODE_ENV === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = env.NODE_ENV;
    fn();
  } finally {
    if (prevSecret === undefined) delete mutableEnv.CRON_SECRET;
    else mutableEnv.CRON_SECRET = prevSecret;
    if (prevNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = prevNodeEnv;
  }
}

export const cronAuthTests = {
  "accepts a matching bearer token"() {
    withEnv({ CRON_SECRET: "s3cret", NODE_ENV: "production" }, () => {
      assertEqual(isAuthorizedCron("Bearer s3cret"), true);
    });
  },

  "rejects a wrong bearer token"() {
    withEnv({ CRON_SECRET: "s3cret", NODE_ENV: "production" }, () => {
      assertEqual(isAuthorizedCron("Bearer nope"), false);
    });
  },

  "rejects a missing header when the secret is set"() {
    withEnv({ CRON_SECRET: "s3cret", NODE_ENV: "production" }, () => {
      assertEqual(isAuthorizedCron(null), false);
      assertEqual(isAuthorizedCron(undefined), false);
      assertEqual(isAuthorizedCron(""), false);
    });
  },

  "rejects a raw token without the Bearer prefix"() {
    withEnv({ CRON_SECRET: "s3cret", NODE_ENV: "production" }, () => {
      assertEqual(isAuthorizedCron("s3cret"), false);
    });
  },

  "LOCKS the endpoint when the secret is missing in production"() {
    // The regression this guards: an unset CRON_SECRET used to return true,
    // silently opening the cron fan-out to anyone in a real deployment.
    withEnv({ CRON_SECRET: undefined, NODE_ENV: "production" }, () => {
      assertEqual(isAuthorizedCron(null), false);
      assertEqual(isAuthorizedCron("Bearer anything"), false);
    });
  },

  "stays permissive when the secret is missing in dev"() {
    withEnv({ CRON_SECRET: undefined, NODE_ENV: "development" }, () => {
      assertEqual(isAuthorizedCron(null), true);
    });
    withEnv({ CRON_SECRET: undefined, NODE_ENV: undefined }, () => {
      assertEqual(isAuthorizedCron(null), true);
    });
  },
};
