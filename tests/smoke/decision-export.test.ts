import {
  EXPORT_SCHEMA_VERSION,
  decisionToMarkdown,
  decisionsToJson,
  decisionsToMarkdownBundle,
  exportFileSlug,
  parseExportFormat,
  type ExportableDecision,
} from "../../src/lib/decision-export";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const DECISION: ExportableDecision = {
  id: "dec_1",
  title: "Move off Auth0",
  summary: "Cost and lock-in outweighed the convenience.",
  category: "engineering",
  status: "approved",
  outcomeStatus: "successful",
  impactLevel: "high",
  problemStatement: "Auth0 costs scale with MAU and we can't self-host.",
  chosenOption: "Roll our own JWT sessions with jose.",
  rationale: "We only need email+password and OIDC.",
  alternativesConsidered: "Keycloak (ops burden), Clerk (same lock-in).",
  assumptions: "Login volume stays under 10k/day.",
  risks: "We own the security surface now.",
  decisionDate: new Date("2025-03-04T00:00:00Z"),
  reviewDate: new Date("2025-09-04T00:00:00Z"),
  createdAt: new Date("2025-03-01T00:00:00Z"),
  updatedAt: new Date("2025-03-05T00:00:00Z"),
  owner: { name: "Sarah" },
  createdBy: { name: "James" },
  tags: [{ tag: { name: "auth" } }, { tag: { name: "infra" } }],
  links: [{ label: "RFC 12", url: "https://example.com/rfc12", linkType: "doc" }],
  reviews: [
    {
      outcomeStatus: "successful",
      summary: "Migration landed with no incidents.",
      lessonsLearned: "Shadow-writing sessions for a week was worth it.",
      followUpAction: "Delete the Auth0 tenant.",
      createdAt: new Date("2025-09-10T00:00:00Z"),
      reviewedBy: { name: "Sarah" },
    },
  ],
};

export const decisionExportTests = {
  "markdown carries every reasoning field under an ADR-shaped heading": () => {
    const md = decisionToMarkdown(DECISION);
    assert(md.startsWith("---\n"), "front matter first");
    assert(md.includes("# Move off Auth0"), "title as H1");
    for (const heading of [
      "## Context / problem",
      "## Decision",
      "## Rationale",
      "## Alternatives considered",
      "## Assumptions",
      "## Risks",
      "## References",
      "## Outcome reviews",
    ]) {
      assert(md.includes(heading), `has ${heading}`);
    }
    assert(md.includes("Keycloak"), "alternatives content present");
    assert(md.includes("[RFC 12](https://example.com/rfc12)"), "links rendered");
    assert(md.includes("Shadow-writing"), "review lessons included");
  },

  "front matter quotes values that would otherwise break YAML": () => {
    const md = decisionToMarkdown({ ...DECISION, title: 'Adopt "strict" mode: phase 1' });
    const line = md.split("\n").find((l) => l.startsWith("title:"))!;
    assert(line.includes('\\"strict\\"'), "inner quotes escaped");
    assert(line.startsWith('title: "'), "value quoted");
  },

  "front matter can be turned off for bundling": () => {
    const md = decisionToMarkdown(DECISION, { frontMatter: false });
    assert(!md.startsWith("---"), "no front matter");
    assert(md.startsWith("# Move off Auth0"), "starts at the title");
  },

  "empty fields are omitted rather than left as empty headings": () => {
    const md = decisionToMarkdown({ id: "d", title: "Bare", rationale: "   " });
    assert(!md.includes("## Rationale"), "whitespace-only field dropped");
    assert(!md.includes("## Risks"), "missing field dropped");
    assert(!md.includes("\n\n\n"), "no triple blank lines");
    assert(md.endsWith("\n"), "ends with a single newline");
  },

  "a base URL adds a link back to the live record": () => {
    const md = decisionToMarkdown(DECISION, { baseUrl: "https://d.acme.com/" });
    assert(md.includes("https://d.acme.com/decisions/dec_1"), "trailing slash normalized");
  },

  "the bundle lists a table of contents and every decision body": () => {
    const bundle = decisionsToMarkdownBundle(
      [DECISION, { id: "d2", title: "Adopt Postgres", status: "approved" }],
      { workspaceName: "Acme decision log" },
    );
    assert(bundle.includes("# Acme decision log"), "workspace title");
    assert(bundle.includes("## Contents"), "TOC present");
    assert(bundle.includes("1. Move off Auth0"), "numbered entry");
    assert(bundle.includes("2. Adopt Postgres"), "second entry");
    assert(bundle.includes("# Adopt Postgres"), "body included");
    assert(bundle.includes("2 decisions"), "count pluralized");
  },

  "the bundle pluralizes a single decision correctly": () => {
    const bundle = decisionsToMarkdownBundle([DECISION]);
    assert(bundle.includes("1 decision ·"), "singular");
  },

  "json export is a versioned envelope with ISO dates": () => {
    const env = decisionsToJson([DECISION], { id: "ws1", name: "Acme", slug: "acme" }, new Date("2025-10-01T00:00:00Z"));
    assert(env.schemaVersion === EXPORT_SCHEMA_VERSION, "version stamped");
    assert(env.exportedAt === "2025-10-01T00:00:00.000Z", "export time");
    assert(env.count === 1 && env.decisions.length === 1, "count matches");
    const d = env.decisions[0];
    assert(d.decisionDate === "2025-03-04T00:00:00.000Z", "dates as ISO strings");
    assert(Array.isArray(d.tags) && (d.tags as string[])[0] === "auth", "tags flattened to names");
    assert((d.reviews as unknown[]).length === 1, "reviews carried");
    assert(d.owner === "Sarah", "owner flattened to a name");
  },

  "json export round-trips through JSON.stringify without loss": () => {
    const env = decisionsToJson([DECISION], { id: "ws1" });
    const parsed = JSON.parse(JSON.stringify(env));
    assert(parsed.decisions[0].title === "Move off Auth0", "survives serialization");
  },

  "missing optional relations export as empty arrays, not undefined": () => {
    const env = decisionsToJson([{ id: "d", title: "Bare" }], { id: "ws1" });
    const d = env.decisions[0];
    assert(Array.isArray(d.tags) && (d.tags as unknown[]).length === 0, "tags empty array");
    assert(Array.isArray(d.links) && (d.links as unknown[]).length === 0, "links empty array");
  },

  "file slugs are filesystem-safe, trimmed, and never empty": () => {
    assert(exportFileSlug("Move off Auth0!") === "move-off-auth0", "slugified");
    assert(exportFileSlug("###") === "decision", "falls back when nothing survives");
    assert(exportFileSlug("a".repeat(200)).length <= 60, "capped");
    assert(!exportFileSlug("Hello -- World --").endsWith("-"), "no trailing separator");
  },

  "format parsing defaults to csv and accepts the markdown alias": () => {
    assert(parseExportFormat(null) === "csv", "default");
    assert(parseExportFormat("bogus") === "csv", "unknown falls back");
    assert(parseExportFormat("JSON") === "json", "case-insensitive");
    assert(parseExportFormat("markdown") === "md", "alias");
  },
};
