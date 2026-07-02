import { assert, assertEqual } from "./run";
import { isViewer, canWrite, isAdmin, VIEWER_ERROR } from "../../src/lib/auth-guards";

/**
 * Role-based access control gates the entire write surface, so a regression
 * here is a real authorization bug - every API mutation calls these.
 */
export const authGuardsTests = {
  "isViewer: matches only 'viewer'"() {
    assertEqual(isViewer("viewer"), true);
    assertEqual(isViewer("member"), false);
    assertEqual(isViewer("admin"), false);
    assertEqual(isViewer(""), false);
    assertEqual(isViewer("VIEWER"), false, "case-sensitive - strings come from DB enum");
  },

  "canWrite: matches admin or member, not viewer"() {
    assertEqual(canWrite("admin"), true);
    assertEqual(canWrite("member"), true);
    assertEqual(canWrite("viewer"), false);
    assertEqual(canWrite(""), false);
    assertEqual(canWrite("guest"), false, "unknown roles must default closed");
  },

  "isAdmin: matches only admin"() {
    assertEqual(isAdmin("admin"), true);
    assertEqual(isAdmin("member"), false);
    assertEqual(isAdmin("viewer"), false);
    assertEqual(isAdmin("super_admin"), false, "no fuzzy substring matching");
  },

  "the three gates are mutually consistent"() {
    // No role should be both a viewer and a writer.
    for (const role of ["admin", "member", "viewer", "guest", ""]) {
      assert(!(isViewer(role) && canWrite(role)), `role "${role}" is both viewer and writer`);
    }
    // Admin should always be able to write.
    assert(canWrite("admin") && isAdmin("admin"), "admin must be able to write");
  },

  "VIEWER_ERROR is the documented 403 body shape"() {
    assertEqual(typeof VIEWER_ERROR.error, "string");
    assert(VIEWER_ERROR.error.length > 0, "error message should be non-empty");
  },
};
