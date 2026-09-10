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
    visibility: { type: "string", enum: ["workspace", "private"] },
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
  "/api/decisions/search",
  "/api/decisions/export",
  "/api/decisions/notes",
  "/api/decisions/reviews",
  "/api/action-items",
  "/api/tags",
  "/api/analytics/trends",
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
