/**
 * Zod schemas for all API route inputs.
 *
 * Each schema is the single source of truth for what a route accepts. Keeping
 * them here (rather than inline in route files) lets multiple routes share the
 * same shape (POST and PUT for decisions are identical) and makes it easy to
 * find validation rules without opening individual route files.
 */

import { z } from "zod";

// ── Reusable primitives ────────────────────────────────────────────────────────

/** Nullable, optional free-text field with a sensible byte cap. */
const longText = (max = 50_000) =>
  z.string().max(max, `Must be ${max} characters or less`).nullable().optional();

/** ISO-8601 date string (date-only or datetime), nullable and optional. */
const isoDateString = z
  .string()
  .refine(
    (v) => !isNaN(Date.parse(v)),
    "Must be a valid date string (e.g. 2025-01-15 or 2025-01-15T00:00:00Z)"
  )
  .nullable()
  .optional();

// ── Decision ───────────────────────────────────────────────────────────────────

/**
 * Shared write shape - used for both POST (create) and PUT (update).
 * All fields except `title` are optional so partial updates work naturally.
 */
export const DecisionWriteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be 200 characters or less"),

  summary: z.string().max(1_000, "Summary must be 1 000 characters or less").nullable().optional(),
  category: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  impactLevel: z.string().max(50).optional(),
  visibility: z.string().max(50).optional(),

  ownerUserId: z.string().nullable().optional(),
  accountableUserId: z.string().nullable().optional(),
  consultedIds: z.array(z.string()).max(100).nullable().optional(),

  problemStatement: longText(),
  chosenOption: longText(),
  rationale: longText(),
  alternativesConsidered: longText(),
  assumptions: longText(),
  risks: longText(),

  decisionDate: isoDateString,
  reviewDate: isoDateString,

  // Client convenience flag - routes translate this to status="draft"
  saveAsDraft: z.boolean().optional(),
});

export type DecisionWriteInput = z.infer<typeof DecisionWriteSchema>;

/**
 * Partial write shape for PUT (update). Every field is optional so inline
 * single-field saves don't have to resend the whole decision - but each
 * field's own rules (e.g. title length, text caps) still apply when present.
 */
export const DecisionPatchSchema = DecisionWriteSchema.partial();
export type DecisionPatchInput = z.infer<typeof DecisionPatchSchema>;

// ── Action Items ────────────────────────────────────────────────────────────────

export const ActionItemWriteSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(5_000).nullable().optional(),
  status: z.string().max(50).optional(),
  priority: z.string().max(50).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: isoDateString,
  decisionId: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export type ActionItemWriteInput = z.infer<typeof ActionItemWriteSchema>;

// ── Notes ──────────────────────────────────────────────────────────────────────

export const NoteWriteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Note content cannot be empty")
    .max(10_000, "Note must be 10 000 characters or less"),
  decisionId: z.string().min(1),
});

export const NoteReplyWriteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Reply content cannot be empty")
    .max(10_000, "Reply must be 10 000 characters or less"),
  noteId: z.string().min(1),
});

export type NoteWriteInput = z.infer<typeof NoteWriteSchema>;

export const NoteDeleteSchema = z.object({ noteId: z.string().min(1) });
export type NoteDeleteInput = z.infer<typeof NoteDeleteSchema>;

// ── Decision sub-resources: reviews / archive / links / tag assignment ───────────

export const ReviewWriteSchema = z.object({
  decisionId: z.string().min(1),
  outcomeStatus: z.string().trim().min(1, "Outcome status is required").max(50),
  summary: z.string().max(10_000).nullable().optional(),
  lessonsLearned: z.string().max(10_000).nullable().optional(),
  followUpAction: z.string().max(10_000).nullable().optional(),
});
export type ReviewWriteInput = z.infer<typeof ReviewWriteSchema>;

export const ArchiveSchema = z.object({ decisionId: z.string().min(1) });
export type ArchiveInput = z.infer<typeof ArchiveSchema>;

export const LinkWriteSchema = z.object({
  decisionId: z.string().min(1),
  label: z.string().trim().min(1, "Label is required").max(200),
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .max(2_000)
    .refine((u) => {
      try { new URL(u); return true; } catch { return false; }
    }, "Please enter a valid URL."),
  linkType: z.string().max(50).optional(),
});
export type LinkWriteInput = z.infer<typeof LinkWriteSchema>;

export const LinkDeleteSchema = z.object({ linkId: z.string().min(1) });
export type LinkDeleteInput = z.infer<typeof LinkDeleteSchema>;

export const DecisionTagSchema = z.object({
  decisionId: z.string().min(1),
  tagId: z.string().min(1),
});
export type DecisionTagInput = z.infer<typeof DecisionTagSchema>;

export const ReactionSchema = z.object({
  emoji: z.enum(["thumbsup", "thumbsdown", "eyes", "warning", "rocket", "question"]),
});
export type ReactionInput = z.infer<typeof ReactionSchema>;

export type NoteReplyWriteInput = z.infer<typeof NoteReplyWriteSchema>;

export const ReplyDeleteSchema = z.object({ replyId: z.string().min(1) });
export type ReplyDeleteInput = z.infer<typeof ReplyDeleteSchema>;

// ── Decision graph (relations / supersede) ───────────────────────────────────────

export const RelationCreateSchema = z.object({
  toDecisionId: z.string().min(1),
  relationType: z.enum(["supersedes", "depends_on", "relates_to", "conflicts_with"]),
});
export type RelationCreateInput = z.infer<typeof RelationCreateSchema>;

export const RelationDeleteSchema = z.object({ relationId: z.string().min(1) });
export type RelationDeleteInput = z.infer<typeof RelationDeleteSchema>;

export const SupersedeSchema = z.object({ toDecisionId: z.string().min(1) });
export type SupersedeInput = z.infer<typeof SupersedeSchema>;

export const BulkSchema = z.object({
  action: z.enum(["archive", "export"]),
  ids: z.array(z.string().min(1)).min(1, "At least one decision id is required").max(500),
});
export type BulkInput = z.infer<typeof BulkSchema>;

// ── Tags ───────────────────────────────────────────────────────────────────────

export const TagWriteSchema = z.object({
  name: z.string().trim().min(1).max(50, "Tag name must be 50 characters or less"),
  color: z.string().max(20).nullable().optional(),
});
export type TagWriteInput = z.infer<typeof TagWriteSchema>;

export const TagDeleteSchema = z.object({ tagId: z.string().min(1) });
export type TagDeleteInput = z.infer<typeof TagDeleteSchema>;

// ── Workspace settings ───────────────────────────────────────────────────────

export const WorkspaceSettingsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(60)
    .transform((s) => s.toLowerCase())
    .refine(
      (s) => /^[a-z0-9-]+$/.test(s),
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
});
export type WorkspaceSettingsInput = z.infer<typeof WorkspaceSettingsSchema>;

// ── Team ───────────────────────────────────────────────────────────────────────

export const TeamInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(254)
    .transform((e) => e.toLowerCase()),
  role: z.enum(["admin", "member", "viewer"]).optional(),
});
export type TeamInviteInput = z.infer<typeof TeamInviteSchema>;

// ── Platform (provider) console ──────────────────────────────────────────────

/**
 * Workspace mutations available only to platform super-admins: rename a company
 * or suspend / reactivate it. All fields optional so the console can patch one
 * axis at a time.
 */
export const PlatformWorkspaceUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100).optional(),
    slug: z
      .string()
      .trim()
      .min(1, "Slug is required")
      .max(60)
      .transform((s) => s.toLowerCase())
      .refine(
        (s) => /^[a-z0-9-]+$/.test(s),
        "Slug must contain only lowercase letters, numbers, and hyphens",
      )
      .optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.slug !== undefined || v.status !== undefined,
    { message: "Provide at least one of: name, slug, status" },
  );
export type PlatformWorkspaceUpdateInput = z.infer<typeof PlatformWorkspaceUpdateSchema>;

// ── Templates ─────────────────────────────────────────────────────────────────

export const TemplateWriteSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  category: z.string().trim().min(1, "Category is required").max(50),
  description: z.string().max(500).nullable().optional(),
  defaultValues: z.record(z.string(), z.unknown()).optional(),
});
export type TemplateWriteInput = z.infer<typeof TemplateWriteSchema>;

// ── Ask DecisionOS ───────────────────────────────────────────────────────────────

export const AskSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Question must be at least 3 characters")
    .max(500, "Question must be 500 characters or less"),
});

export type AskInput = z.infer<typeof AskSchema>;

// ── AI provider config (Anthropic / compatible) ─────────────────────────────────

/**
 * Validates the encrypted `anthropic` integration config. `model` is free-text
 * so workspaces can target a self-hosted or custom model id; `baseUrl` lets them
 * point at any Anthropic-compatible endpoint. The API key may be blank when a
 * base URL is set (local gateways often need no auth) - the route preserves any
 * previously stored key when the field is left blank.
 */
export const AnthropicConfigSchema = z.object({
  apiKey: z.string().max(500).optional(),
  model: z.string().trim().max(100).optional(),
  baseUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || /^https?:\/\//i.test(v),
      "Base URL must start with http:// or https://",
    )
    .optional(),
});

export type AnthropicConfigInput = z.infer<typeof AnthropicConfigSchema>;

// ── Auth ───────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email("Must be a valid email address").max(254),
  password: z.string().min(1, "Password is required").max(1_024),
});

// ── Shared helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a request body against a schema and return a typed result.
 * On failure returns { ok: false, error } - routes call NextResponse.json on this.
 */
export function parseBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; error: Record<string, unknown>; status: 400 } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    error: { error: "Validation failed", details: result.error.flatten() },
    status: 400,
  };
}
