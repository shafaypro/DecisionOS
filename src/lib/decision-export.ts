/**
 * Portable export formats for decision records.
 *
 * CSV (csv.ts) is for spreadsheets. This module covers the two formats that
 * matter for *keeping* a decision log: Markdown, so a record can live in a repo
 * next to the code it governs (the ADR convention), and JSON, so a workspace can
 * be backed up or moved without screen-scraping the UI.
 *
 * Both serializers are pure - they take plain rows, not Prisma clients - so the
 * exact bytes we hand a user are unit-testable.
 */

export interface ExportableDecision {
  id: string;
  title: string;
  summary?: string | null;
  category?: string | null;
  status?: string | null;
  outcomeStatus?: string | null;
  impactLevel?: string | null;
  problemStatement?: string | null;
  chosenOption?: string | null;
  rationale?: string | null;
  alternativesConsidered?: string | null;
  assumptions?: string | null;
  risks?: string | null;
  decisionDate?: Date | null;
  reviewDate?: Date | null;
  reviewedAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  owner?: { name: string } | null;
  createdBy?: { name: string } | null;
  tags?: { tag: { name: string } }[];
  links?: { label: string; url: string; linkType?: string | null }[];
  reviews?: {
    outcomeStatus: string;
    summary?: string | null;
    lessonsLearned?: string | null;
    followUpAction?: string | null;
    createdAt: Date;
    reviewedBy?: { name: string } | null;
  }[];
}

const isoDate = (d: Date | null | undefined): string | null =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

/** YAML front matter value escaping - quote anything that could break parsing. */
function yamlValue(value: string | null | undefined): string {
  if (value == null || value === "") return '""';
  if (/^[A-Za-z0-9][A-Za-z0-9 _./-]*$/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function section(heading: string, body: string | null | undefined): string[] {
  if (!body || !body.trim()) return [];
  return [`## ${heading}`, "", body.trim(), ""];
}

export interface MarkdownExportOptions {
  /** Absolute base URL, so the exported file links back to the live record. */
  baseUrl?: string;
  /** Include YAML front matter (default true) - handy for static-site ADR repos. */
  frontMatter?: boolean;
}

/**
 * Render one decision as an ADR-style Markdown document.
 *
 * The layout follows the widely used ADR shape (context → decision →
 * consequences) so exported files drop straight into an existing `docs/adr`
 * directory, while keeping DecisionOS's extra fields as their own sections.
 */
export function decisionToMarkdown(
  d: ExportableDecision,
  opts: MarkdownExportOptions = {},
): string {
  const lines: string[] = [];

  if (opts.frontMatter !== false) {
    lines.push(
      "---",
      `id: ${yamlValue(d.id)}`,
      `title: ${yamlValue(d.title)}`,
      `status: ${yamlValue(d.status ?? "draft")}`,
      `category: ${yamlValue(d.category ?? "other")}`,
      `impact: ${yamlValue(d.impactLevel ?? "medium")}`,
      `outcome: ${yamlValue(d.outcomeStatus ?? "unknown")}`,
      `owner: ${yamlValue(d.owner?.name ?? null)}`,
      `decided: ${yamlValue(isoDate(d.decisionDate))}`,
      `review: ${yamlValue(isoDate(d.reviewDate))}`,
      `tags: [${(d.tags ?? []).map((t) => yamlValue(t.tag.name)).join(", ")}]`,
      "---",
      "",
    );
  }

  lines.push(`# ${d.title}`, "");

  const meta = [
    d.status && `**Status:** ${d.status}`,
    d.impactLevel && `**Impact:** ${d.impactLevel}`,
    d.owner?.name && `**Owner:** ${d.owner.name}`,
    isoDate(d.decisionDate) && `**Decided:** ${isoDate(d.decisionDate)}`,
    isoDate(d.reviewDate) && `**Review due:** ${isoDate(d.reviewDate)}`,
  ].filter(Boolean) as string[];
  if (meta.length) lines.push(meta.join(" · "), "");

  if (d.summary?.trim()) lines.push(`> ${d.summary.trim()}`, "");

  lines.push(
    ...section("Context / problem", d.problemStatement),
    ...section("Decision", d.chosenOption),
    ...section("Rationale", d.rationale),
    ...section("Alternatives considered", d.alternativesConsidered),
    ...section("Assumptions", d.assumptions),
    ...section("Risks", d.risks),
  );

  if (d.links?.length) {
    lines.push("## References", "");
    for (const l of d.links) {
      const type = l.linkType && l.linkType !== "other" ? ` _(${l.linkType})_` : "";
      lines.push(`- [${l.label}](${l.url})${type}`);
    }
    lines.push("");
  }

  if (d.reviews?.length) {
    lines.push("## Outcome reviews", "");
    for (const r of d.reviews) {
      const who = r.reviewedBy?.name ? ` by ${r.reviewedBy.name}` : "";
      lines.push(`### ${isoDate(r.createdAt)} - ${r.outcomeStatus}${who}`, "");
      if (r.summary?.trim()) lines.push(r.summary.trim(), "");
      if (r.lessonsLearned?.trim()) lines.push(`**Lessons learned:** ${r.lessonsLearned.trim()}`, "");
      if (r.followUpAction?.trim()) lines.push(`**Follow-up:** ${r.followUpAction.trim()}`, "");
    }
  }

  const footer: string[] = [];
  if (opts.baseUrl) footer.push(`[View in DecisionOS](${opts.baseUrl.replace(/\/$/, "")}/decisions/${d.id})`);
  if (d.createdBy?.name) footer.push(`Recorded by ${d.createdBy.name}`);
  if (isoDate(d.updatedAt)) footer.push(`Last updated ${isoDate(d.updatedAt)}`);
  if (footer.length) lines.push("---", "", `_${footer.join(" · ")}_`, "");

  // Collapse runs of blank lines so the document round-trips cleanly.
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Render many decisions as one Markdown bundle with a table-of-contents. */
export function decisionsToMarkdownBundle(
  decisions: ExportableDecision[],
  opts: MarkdownExportOptions & { workspaceName?: string } = {},
): string {
  const header = [
    `# ${opts.workspaceName ?? "Decision log"}`,
    "",
    `_${decisions.length} decision${decisions.length === 1 ? "" : "s"} · exported ${new Date()
      .toISOString()
      .slice(0, 10)}_`,
    "",
    "## Contents",
    "",
    ...decisions.map((d, i) => `${i + 1}. ${d.title}${d.status ? ` — _${d.status}_` : ""}`),
    "",
    "---",
    "",
  ];
  const bodies = decisions.map((d) => decisionToMarkdown(d, { ...opts, frontMatter: false }));
  return header.join("\n") + bodies.join("\n---\n\n");
}

/** A stable, documented JSON envelope - the format the importer will expect. */
export const EXPORT_SCHEMA_VERSION = 1;

export interface DecisionExportEnvelope {
  schemaVersion: number;
  exportedAt: string;
  workspace: { id: string; name?: string; slug?: string };
  count: number;
  decisions: Record<string, unknown>[];
}

export function decisionsToJson(
  decisions: ExportableDecision[],
  workspace: { id: string; name?: string; slug?: string },
  now: Date = new Date(),
): DecisionExportEnvelope {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    workspace,
    count: decisions.length,
    decisions: decisions.map((d) => ({
      id: d.id,
      title: d.title,
      summary: d.summary ?? null,
      category: d.category ?? null,
      status: d.status ?? null,
      outcomeStatus: d.outcomeStatus ?? null,
      impactLevel: d.impactLevel ?? null,
      problemStatement: d.problemStatement ?? null,
      chosenOption: d.chosenOption ?? null,
      rationale: d.rationale ?? null,
      alternativesConsidered: d.alternativesConsidered ?? null,
      assumptions: d.assumptions ?? null,
      risks: d.risks ?? null,
      decisionDate: d.decisionDate ? new Date(d.decisionDate).toISOString() : null,
      reviewDate: d.reviewDate ? new Date(d.reviewDate).toISOString() : null,
      reviewedAt: d.reviewedAt ? new Date(d.reviewedAt).toISOString() : null,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
      owner: d.owner?.name ?? null,
      createdBy: d.createdBy?.name ?? null,
      tags: (d.tags ?? []).map((t) => t.tag.name),
      links: (d.links ?? []).map((l) => ({ label: l.label, url: l.url, type: l.linkType ?? "other" })),
      reviews: (d.reviews ?? []).map((r) => ({
        outcomeStatus: r.outcomeStatus,
        summary: r.summary ?? null,
        lessonsLearned: r.lessonsLearned ?? null,
        followUpAction: r.followUpAction ?? null,
        reviewedBy: r.reviewedBy?.name ?? null,
        createdAt: new Date(r.createdAt).toISOString(),
      })),
    })),
  };
}

/** Filesystem-safe slug for an exported file name. */
export function exportFileSlug(title: string, max = 60): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
  return slug || "decision";
}

export const EXPORT_FORMATS = ["csv", "json", "md"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Coerce an untrusted `?format=` value; defaults to csv for backwards compat. */
export function parseExportFormat(value: string | null | undefined): ExportFormat {
  const v = (value ?? "").toLowerCase();
  if (v === "json") return "json";
  if (v === "md" || v === "markdown") return "md";
  return "csv";
}
