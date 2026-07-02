import { assert, assertEqual } from "./run";
import { isPlatformAdminEmail, getPlatformAdminEmails } from "../../src/lib/env";
import { authorizePlatform } from "../../src/lib/platform-authorize";
import { isPlatformAdmin } from "../../src/lib/auth-guards";

/**
 * Platform (provider) privilege is the gate to the cross-tenant /admin console,
 * so the rule must hold under every env permutation - especially that staff
 * status comes ONLY from the PLATFORM_ADMIN_EMAILS allow-list and can never be
 * inferred from a workspace role or a missing env var.
 */
function withEmails(value: string | undefined, fn: () => void) {
  const prev = process.env.PLATFORM_ADMIN_EMAILS;
  try {
    if (value === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = value;
    fn();
  } finally {
    if (prev === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = prev;
  }
}

export const platformAuthTests = {
  "allow-list matches an exact email"() {
    withEmails("ops@decisionos.app", () => {
      assertEqual(isPlatformAdminEmail("ops@decisionos.app"), true);
    });
  },

  "allow-list is case- and whitespace-insensitive"() {
    withEmails("  Ops@DecisionOS.App , you@decisionos.app ", () => {
      assertEqual(isPlatformAdminEmail("OPS@decisionos.app"), true);
      assertEqual(isPlatformAdminEmail("you@DECISIONOS.app"), true);
      assertEqual(getPlatformAdminEmails().length, 2);
    });
  },

  "non-listed email is not staff"() {
    withEmails("ops@decisionos.app", () => {
      assertEqual(isPlatformAdminEmail("member@acme.demo"), false);
    });
  },

  "empty or unset allow-list yields no platform admins (fails closed)"() {
    withEmails(undefined, () => {
      assertEqual(getPlatformAdminEmails().length, 0);
      assertEqual(isPlatformAdminEmail("ops@decisionos.app"), false);
    });
    withEmails("   ", () => {
      assertEqual(isPlatformAdminEmail("ops@decisionos.app"), false);
    });
  },

  "isPlatformAdminEmail handles null/empty input"() {
    withEmails("ops@decisionos.app", () => {
      assertEqual(isPlatformAdminEmail(null), false);
      assertEqual(isPlatformAdminEmail(undefined), false);
      assertEqual(isPlatformAdminEmail(""), false);
    });
  },

  "isPlatformAdmin only accepts the superadmin marker"() {
    assertEqual(isPlatformAdmin("superadmin"), true);
    assertEqual(isPlatformAdmin(undefined), false);
    assertEqual(isPlatformAdmin("admin"), false); // workspace admin != platform admin
    assertEqual(isPlatformAdmin(""), false);
  },

  "authorizePlatform: staff session is allowed"() {
    const r = authorizePlatform({ platformRole: "superadmin" });
    assert(r.ok, "superadmin should pass");
  },

  "authorizePlatform: missing session is 401"() {
    const r = authorizePlatform(null);
    assert(!r.ok && r.status === 401, "null session should be 401");
  },

  "authorizePlatform: non-staff session is 403"() {
    const r = authorizePlatform({ platformRole: undefined });
    assert(!r.ok && r.status === 403, "no platformRole should be 403");
  },
};
