import { assert, assertEqual } from "./run";
import {
  parseBody,
  LinkWriteSchema,
  WorkspaceSettingsSchema,
  TeamInviteSchema,
  PlatformWorkspaceUpdateSchema,
  AnthropicConfigSchema,
  ReactionSchema,
  BulkSchema,
  ActionItemPatchSchema,
} from "../../src/lib/schemas";

/**
 * The Zod schemas are the single source of truth for what every API route
 * accepts - the first line of defense before a handler ever touches the DB.
 * These assert the refinements and transforms that are easy to regress:
 * slug normalization, email lowercasing, URL validity, enum guards, the
 * "at least one field" platform refine, and the shared parseBody result shape.
 */
export const schemasTests = {
  "parseBody returns typed data on success"() {
    const r = parseBody(ReactionSchema, { emoji: "rocket" });
    assert(r.ok, "should succeed");
    if (r.ok) assertEqual(r.data.emoji, "rocket");
  },

  "parseBody returns a 400 error envelope on failure"() {
    const r = parseBody(ReactionSchema, { emoji: "not-an-emoji" });
    assert(!r.ok, "should fail");
    if (!r.ok) {
      assertEqual(r.status, 400);
      assertEqual(r.error.error, "Validation failed");
      assert("details" in r.error, "must include flattened details");
    }
  },

  "LinkWriteSchema accepts a valid URL"() {
    const r = parseBody(LinkWriteSchema, {
      decisionId: "d1",
      label: "RFC",
      url: "https://example.com/rfc",
    });
    assert(r.ok, "valid URL should pass");
  },

  "LinkWriteSchema rejects a malformed URL"() {
    const r = parseBody(LinkWriteSchema, {
      decisionId: "d1",
      label: "RFC",
      url: "not a url",
    });
    assert(!r.ok, "malformed URL must be rejected");
  },

  "WorkspaceSettingsSchema lowercases the slug and rejects bad characters"() {
    const ok = WorkspaceSettingsSchema.safeParse({ name: "Acme", slug: "Acme-Team" });
    assert(ok.success, "valid slug should pass");
    if (ok.success) assertEqual(ok.data.slug, "acme-team");

    const bad = WorkspaceSettingsSchema.safeParse({ name: "Acme", slug: "has spaces!" });
    assert(!bad.success, "slug with spaces/punctuation must be rejected");
  },

  "TeamInviteSchema trims and lowercases the email"() {
    const r = TeamInviteSchema.safeParse({ email: "  USER@Acme.COM ", role: "member" });
    assert(r.success, "should parse");
    if (r.success) assertEqual(r.data.email, "user@acme.com");
  },

  "PlatformWorkspaceUpdateSchema requires at least one field"() {
    const empty = parseBody(PlatformWorkspaceUpdateSchema, {});
    assert(!empty.ok, "empty patch must be rejected by the refine");

    const one = parseBody(PlatformWorkspaceUpdateSchema, { status: "suspended" });
    assert(one.ok, "a single axis should be enough");
  },

  "PlatformWorkspaceUpdateSchema rejects an unknown status"() {
    const r = parseBody(PlatformWorkspaceUpdateSchema, { status: "deleted" });
    assert(!r.ok, "status enum is closed");
  },

  "AnthropicConfigSchema validates the base URL scheme"() {
    assert(AnthropicConfigSchema.safeParse({ baseUrl: "" }).success, "blank is allowed");
    assert(AnthropicConfigSchema.safeParse({ baseUrl: "https://gw.local" }).success, "https allowed");
    assert(!AnthropicConfigSchema.safeParse({ baseUrl: "ftp://gw" }).success, "ftp rejected");
  },

  "BulkSchema enforces a closed action set and id bounds"() {
    assert(parseBody(BulkSchema, { action: "archive", ids: ["a"] }).ok, "archive is valid");
    assert(!parseBody(BulkSchema, { action: "delete", ids: ["a"] }).ok, "delete is not a bulk action");
    assert(!parseBody(BulkSchema, { action: "archive", ids: [] }).ok, "at least one id required");
    const tooMany = Array.from({ length: 501 }, (_, i) => `id${i}`);
    assert(!parseBody(BulkSchema, { action: "archive", ids: tooMany }).ok, "max 500 ids");
  },

  "ActionItemPatchSchema allows single-field updates but still validates them"() {
    assert(parseBody(ActionItemPatchSchema, { status: "done" }).ok, "single field ok");
    assert(parseBody(ActionItemPatchSchema, {}).ok, "empty patch is allowed (partial)");
    // title, when present, must be non-empty after trim
    assert(!parseBody(ActionItemPatchSchema, { title: "   " }).ok, "blank title rejected");
  },
};
