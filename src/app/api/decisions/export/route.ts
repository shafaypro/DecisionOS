import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { withApi } from "@/lib/api-handler";
import { decisionVisibilityWhere } from "@/lib/tenant";
import { exportLimiter, mutationKey } from "@/lib/rate-limit";
import { csvCell as escapeCsv } from "@/lib/csv";
import {
  decisionsToJson,
  decisionsToMarkdownBundle,
  parseExportFormat,
} from "@/lib/decision-export";

function formatCsvDate(date: Date | null | undefined): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

/**
 * Export the caller's visible decision log.
 *
 * `?format=` picks the shape: `csv` (default, spreadsheet-friendly), `json` (a
 * versioned envelope suitable for backup/migration), or `md` (one Markdown
 * bundle with a table of contents, for committing next to the code).
 */
export const GET = withApi<undefined>({ require: "auth" }, async ({ session, req }) => {
  const limit = await exportLimiter.check(mutationKey(session));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many exports. Please wait a moment." },
      { status: 429, headers: limit.headers },
    );
  }

  const formatKind = parseExportFormat(new URL(req.url).searchParams.get("format"));
  // Export only what the caller may see: workspace-visible + their own private.
  const visible = decisionVisibilityWhere(session);
  const stamp = format(new Date(), "yyyy-MM-dd");

  // The portable formats carry references and full review history, which CSV
  // flattens to counts - so they get their own query rather than making every
  // CSV export pay for the joins.
  if (formatKind !== "csv") {
    const [decisions, workspace] = await Promise.all([
      prisma.decision.findMany({
        where: visible,
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { name: true } },
          createdBy: { select: { name: true } },
          tags: { include: { tag: { select: { name: true } } } },
          links: { select: { label: true, url: true, linkType: true } },
          reviews: {
            orderBy: { createdAt: "desc" },
            include: { reviewedBy: { select: { name: true } } },
          },
        },
      }),
      prisma.workspace.findUnique({
        where: { id: session.workspaceId },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    if (formatKind === "json") {
      const envelope = decisionsToJson(decisions, workspace ?? { id: session.workspaceId });
      return new NextResponse(JSON.stringify(envelope, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="decisions-${stamp}.json"`,
        },
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const bundle = decisionsToMarkdownBundle(decisions, {
      baseUrl,
      workspaceName: workspace?.name ? `${workspace.name} decision log` : undefined,
    });
    return new NextResponse(bundle, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="decisions-${stamp}.md"`,
      },
    });
  }

  const decisions = await prisma.decision.findMany({
    where: visible,
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { name: true } },
      createdBy: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
      _count: { select: { notes: true, reviews: true } },
    },
  });

  const headers = [
    "ID", "Title", "Summary", "Category", "Status", "Outcome",
    "Impact", "Owner", "Created By", "Decision Date", "Review Date",
    "Reviewed At", "Problem Statement", "Solution", "Rationale",
    "Alternatives", "Assumptions", "Risks", "Tags", "Notes Count",
    "Reviews Count", "Created At", "Updated At",
  ];

  const rows = decisions.map((d) => [
    escapeCsv(d.id),
    escapeCsv(d.title),
    escapeCsv(d.summary),
    escapeCsv(d.category),
    escapeCsv(d.status),
    escapeCsv(d.outcomeStatus),
    escapeCsv(d.impactLevel),
    escapeCsv(d.owner?.name),
    escapeCsv(d.createdBy.name),
    escapeCsv(formatCsvDate(d.decisionDate)),
    escapeCsv(formatCsvDate(d.reviewDate)),
    escapeCsv(formatCsvDate(d.reviewedAt)),
    escapeCsv(d.problemStatement),
    escapeCsv(d.chosenOption),
    escapeCsv(d.rationale),
    escapeCsv(d.alternativesConsidered),
    escapeCsv(d.assumptions),
    escapeCsv(d.risks),
    escapeCsv(d.tags.map((dt) => dt.tag.name).join("; ")),
    String(d._count.notes),
    String(d._count.reviews),
    escapeCsv(formatCsvDate(d.createdAt)),
    escapeCsv(formatCsvDate(d.updatedAt)),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const filename = `decisions-${stamp}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
