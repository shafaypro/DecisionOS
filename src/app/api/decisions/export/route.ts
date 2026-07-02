import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { withApi } from "@/lib/api-handler";
import { decisionVisibilityWhere } from "@/lib/tenant";
import { exportLimiter, mutationKey } from "@/lib/rate-limit";

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCsvDate(date: Date | null | undefined): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

export const GET = withApi<undefined>({ require: "auth" }, async ({ session }) => {
  const limit = await exportLimiter.check(mutationKey(session));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many exports. Please wait a moment." },
      { status: 429, headers: limit.headers },
    );
  }

  // Export only what the caller may see: workspace-visible + their own private.
  const decisions = await prisma.decision.findMany({
    where: decisionVisibilityWhere(session),
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
  const filename = `decisions-${format(new Date(), "yyyy-MM-dd")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
