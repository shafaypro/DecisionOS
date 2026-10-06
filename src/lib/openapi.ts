/**
 * Machine-readable description of the DecisionOS HTTP API.
 *
 * Self-hosted teams script against this API - back up the log, pipe decisions
 * into a wiki, wire a bot - and until now the only spec was the route folder.
 * This module builds an OpenAPI 3.1 document that `/api/openapi` serves, so the
 * usual tooling (Swagger UI, Postman, client generators) works out of the box.
 *
 * The document is built in code rather than kept as a static JSON file so the
 * server URL follows the deployment and a test can assert that every documented
 * path actually exists in the route tree.
 */

type Json = Record<string, unknown>;

const errorResponse = (description: string): Json => ({
  description,
  content: {
    "application/json": {
      schema: { type: "object", properties: { error: { type: "string" } } },
    },
  },
});

const COMMON_ERRORS: Json = {
  "401": errorResponse("Not authenticated, or workspace access has been revoked."),
  "403": errorResponse("Authenticated but not permitted (role or workspace status)."),
  "429": errorResponse("Rate limited. Retry after the window in the response headers."),
  "500": errorResponse("Unexpected server error."),
};

const DECISION_SCHEMA: Json = {
  type: "object",
  required: ["id", "title"],
  properties: {
    id: { type: "string" },
    title: { type: "string", minLength: 3, maxLength: 200 },
    summary: { type: "string", nullable: true, maxLength: 1000 },
    category: {
      type: "string",
      enum: [
        "product", "engineering", "business", "hiring",
        "finance", "marketing", "strategy", "operations", "other",
      ],
    },
    status: {
      type: "string",
      enum: ["draft", "proposed", "in_review", "approved", "reversed", "superseded", "archived"],
    },
    outcomeStatus: { type: "string", enum: ["unknown", "successful", "mixed", "unsuccessful"] },
    impactLevel: { type: "string", enum: ["low", "medium", "high"] },
    visibility: {
      type: "string",
      enum: ["workspace", "private"],
      description: "Private decisions are visible only to their author. Only the author or an admin can change this.",
    },
    problemStatement: { type: "string", nullable: true },
    chosenOption: { type: "string", nullable: true },
    rationale: { type: "string", nullable: true },
    alternativesConsidered: { type: "string", nullable: true },
    assumptions: { type: "string", nullable: true },
    risks: { type: "string", nullable: true },
    ownerUserId: { type: "string", nullable: true },
    decisionDate: { type: "string", format: "date-time", nullable: true },
    reviewDate: { type: "string", format: "date-time", nullable: true },
  },
};

/** Paths the spec documents. Exported so a test can cross-check the route tree. */
export const DOCUMENTED_PATHS = [
  "/api/health",
  "/api/decisions",
  "/api/decisions/{id}",
  "/api/decisions/{id}/markdown",
  "/api/decisions/{id}/share",
  "/api/decisions/search",
  "/api/decisions/export",
  "/api/decisions/notes",
  "/api/decisions/reviews",
  "/api/action-items",
  "/api/tags",
  "/api/analytics/trends",
  "/api/team",
  "/api/team/{id}",
  "/api/settings/sharing",
] as const;

export interface OpenApiOptions {
  /** Public base URL of this deployment, e.g. https://decisions.acme.com */
  baseUrl?: string;
  version?: string;
}

export function buildOpenApiDocument({ baseUrl, version = "0.1.0" }: OpenApiOptions = {}): Json {
  return {
    openapi: "3.1.0",
    info: {
      title: "DecisionOS API",
      version,
      description:
        "HTTP API for the DecisionOS decision log. Every endpoint is scoped to the " +
        "caller's workspace; there is no cross-workspace access. Authentication is a " +
        "session cookie issued by POST /api/auth/login (or SSO).",
      license: { name: "MIT", identifier: "MIT" },
    },
    servers: [{ url: baseUrl?.replace(/\/$/, "") ?? "http://localhost:3001" }],
    tags: [
      { name: "Decisions", description: "The decision log itself." },
      { name: "Export", description: "Portable copies of the log (CSV / JSON / Markdown)." },
      { name: "Collaboration", description: "Notes and outcome reviews." },
      { name: "Work", description: "Action items generated from decisions." },
      { name: "Insight", description: "Derived analytics over the log." },
      { name: "Ops", description: "Health and operational endpoints." },
      { name: "Sharing", description: "Opt-in public read-only links." },
      { name: "Team", description: "Members, invitations, and roles (admin only)." },
    ],
    components: {
      securitySchemes: {
        sessionCookie: { type: "apiKey", in: "cookie", name: "decisionos_session" },
      },
      schemas: {
        Decision: DECISION_SCHEMA,
        Error: { type: "object", properties: { error: { type: "string" } } },
      },
    },
    security: [{ sessionCookie: [] }],
    paths: {
      "/api/health": {
        get: {
          tags: ["Ops"],
          summary: "Liveness / readiness probe",
          security: [],
          responses: { "200": { description: "Service is up." } },
        },
      },
      "/api/decisions": {
        post: {
          tags: ["Decisions"],
          summary: "Create a decision",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/Decision" } } },
          },
          responses: {
            "200": {
              description: "Created.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { success: { type: "boolean" }, id: { type: "string" } },
                  },
                },
              },
            },
            "400": errorResponse("Validation failed; `details` carries the field errors."),
            ...COMMON_ERRORS,
          },
        },
      },
      "/api/decisions/{id}": {
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        put: {
          tags: ["Decisions"],
          summary: "Update a decision (partial body allowed)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/Decision" } } },
          },
          responses: { "200": { description: "Updated." }, ...COMMON_ERRORS },
        },
        delete: {
          tags: ["Decisions"],
          summary: "Delete a decision",
          responses: { "200": { description: "Deleted." }, ...COMMON_ERRORS },
        },
      },
      "/api/decisions/{id}/markdown": {
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        get: {
          tags: ["Export"],
          summary: "Download one decision as an ADR-style Markdown file",
          responses: {
            "200": {
              description: "Markdown document.",
              content: { "text/markdown": { schema: { type: "string" } } },
            },
            "404": errorResponse("No such decision in this workspace."),
            ...COMMON_ERRORS,
          },
        },
      },
      "/api/decisions/{id}/share": {
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        post: {
          tags: ["Sharing"],
          summary: "Create (or return) the decision's public read-only link",
          description:
            "Idempotent. The link is /share/<token> with a random token, never the decision id. " +
            "Refused for private decisions and when the workspace has public links turned off.",
          responses: {
            ...COMMON_ERRORS,
            "200": {
              description: "The public URL.",
              content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" } } } } },
            },
            "400": errorResponse("The decision is private."),
            "403": errorResponse("Viewer role, or public links are off for this workspace."),
            "404": errorResponse("No such decision visible to you."),
          },
        },
        delete: {
          tags: ["Sharing"],
          summary: "Revoke the public link",
          description: "The old URL stops working immediately. Sharing again issues a new token.",
          responses: {
            ...COMMON_ERRORS,
            "200": { description: "Revoked (or was not shared)." },
            "404": errorResponse("No such decision visible to you."),
          },
        },
      },
      "/api/settings/sharing": {
        put: {
          tags: ["Sharing"],
          summary: "Allow or disallow public links for the workspace (admin)",
          description: "Turning links off revokes every existing link; turning them back on doesn't restore them.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", required: ["publicSharing"], properties: { publicSharing: { type: "boolean" } } },
              },
            },
          },
          responses: {
            ...COMMON_ERRORS,
            "200": { description: "Saved." },
            "403": errorResponse("Not an admin."),
          },
        },
      },
      "/api/team": {
        post: {
          tags: ["Team"],
          summary: "Invite someone to the workspace (admin)",
          description:
            "A new address gets an account and a 7-day set-password link by email. When email isn't configured, " +
            "the link comes back as `inviteUrl` for the admin to pass on. An existing account is added without a link.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  properties: {
                    email: { type: "string", format: "email" },
                    role: { type: "string", enum: ["admin", "member", "viewer"] },
                  },
                },
              },
            },
          },
          responses: {
            ...COMMON_ERRORS,
            "200": {
              description: "Invited.",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { success: { type: "string" }, inviteUrl: { type: "string" } } },
                },
              },
            },
            "400": errorResponse("Already a member, or invalid input."),
            "403": errorResponse("Not an admin."),
          },
        },
      },
      "/api/team/{id}": {
        parameters: [
          { name: "id", in: "path", required: true, description: "Membership id", schema: { type: "string" } },
        ],
        patch: {
          tags: ["Team"],
          summary: "Change a member's role (admin)",
          description: "The workspace always keeps at least one admin. A demotion applies on the member's next request.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["role"],
                  properties: { role: { type: "string", enum: ["admin", "member", "viewer"] } },
                },
              },
            },
          },
          responses: {
            ...COMMON_ERRORS,
            "200": { description: "Role changed." },
            "400": errorResponse("Would leave the workspace without an admin, or invalid role."),
            "403": errorResponse("Not an admin."),
            "404": errorResponse("No such member in this workspace."),
          },
        },
        delete: {
          tags: ["Team"],
          summary: "Remove a member (admin)",
          responses: {
            ...COMMON_ERRORS,
            "200": { description: "Removed. Their decisions, notes, and reviews stay." },
            "400": errorResponse("Would remove the last admin."),
            "403": errorResponse("Not an admin."),
            "404": errorResponse("No such member in this workspace."),
          },
        },
      },
      "/api/decisions/search": {
        get: {
          tags: ["Decisions"],
          summary: "Search the log with the filter syntax",
          description:
            "`q` accepts free text plus filters: `status:`, `category:`, `impact:`, " +
            "`outcome:`, `owner:` (`owner:me`), `tag:`, `health:`, `before:`, `after:` " +
            "(absolute dates or relative like `30d`), and `is:` " +
            "(`mine`, `unowned`, `overdue`, `draft`, `reviewed`, `private`). " +
            "Prefix a filter with `-` to exclude.",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" }, example: "status:approved owner:me -tag:legacy" },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 } },
          ],
          responses: {
            "200": {
              description: "Ranked matches plus any parser warnings.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      decisions: { type: "array", items: { $ref: "#/components/schemas/Decision" } },
                      warnings: { type: "array", items: { type: "string" } },
                      describe: { type: "string" },
                    },
                  },
                },
              },
            },
            ...COMMON_ERRORS,
          },
        },
      },
      "/api/decisions/export": {
        get: {
          tags: ["Export"],
          summary: "Export the whole visible log",
          parameters: [
            {
              name: "format",
              in: "query",
              schema: { type: "string", enum: ["csv", "json", "md"], default: "csv" },
            },
          ],
          responses: {
            "200": {
              description: "The export, as an attachment.",
              content: {
                "text/csv": { schema: { type: "string" } },
                "application/json": { schema: { type: "object" } },
                "text/markdown": { schema: { type: "string" } },
              },
            },
            ...COMMON_ERRORS,
          },
        },
      },
      "/api/decisions/notes": {
        post: {
          tags: ["Collaboration"],
          summary: "Add a note to a decision",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["decisionId", "content"],
                  properties: { decisionId: { type: "string" }, content: { type: "string" } },
                },
              },
            },
          },
          responses: { "200": { description: "Created." }, ...COMMON_ERRORS },
        },
      },
      "/api/decisions/reviews": {
        post: {
          tags: ["Collaboration"],
          summary: "Submit an outcome review",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["decisionId", "outcomeStatus"],
                  properties: {
                    decisionId: { type: "string" },
                    outcomeStatus: {
                      type: "string",
                      enum: ["unknown", "successful", "mixed", "unsuccessful"],
                    },
                    summary: { type: "string", nullable: true },
                    lessonsLearned: { type: "string", nullable: true },
                    followUpAction: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Recorded." }, ...COMMON_ERRORS },
        },
      },
      "/api/action-items": {
        get: {
          tags: ["Work"],
          summary: "List action items in the workspace",
          responses: { "200": { description: "Items." }, ...COMMON_ERRORS },
        },
        post: {
          tags: ["Work"],
          summary: "Create an action item",
          responses: { "200": { description: "Created." }, ...COMMON_ERRORS },
        },
      },
      "/api/tags": {
        get: {
          tags: ["Decisions"],
          summary: "List workspace tags",
          responses: { "200": { description: "Tags." }, ...COMMON_ERRORS },
        },
      },
      "/api/analytics/trends": {
        get: {
          tags: ["Insight"],
          summary: "Time-series trends over the decision log",
          parameters: [
            { name: "months", in: "query", schema: { type: "integer", minimum: 1, maximum: 36, default: 12 } },
          ],
          responses: {
            "200": {
              description:
                "Monthly buckets, cycle times, momentum vs the prior window, and the outcome mix.",
              content: { "application/json": { schema: { type: "object" } } },
            },
            ...COMMON_ERRORS,
          },
        },
      },
    },
  };
}
