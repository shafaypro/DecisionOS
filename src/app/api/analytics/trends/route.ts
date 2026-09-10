import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { decisionVisibilityWhere } from "@/lib/tenant";
import { computeTrends } from "@/lib/trends";
import { summarizeQuality } from "@/lib/decision-quality";

/**
 * Time-series view of the decision log: monthly throughput, cycle times, review
 * compliance, momentum against the prior window, and the record-quality roll-up.
 *
 * Served as JSON (rather than only rendered into the analytics page) so teams
 * can graph it in whatever they already use.
 */
export const GET = withApi<undefined>({ require: "auth" }, async ({ session, req }) => {
  const monthsParam = Number(new URL(req.url).searchParams.get("months"));
  const months = Number.isFinite(monthsParam)
    ? Math.min(36, Math.max(1, Math.trunc(monthsParam)))
    : 12;

  const rows = await prisma.decision.findMany({
    where: decisionVisibilityWhere(session),
    select: {
      createdAt: true,
      decisionDate: true,
      reviewDate: true,
      reviewedAt: true,
      status: true,
      outcomeStatus: true,
      summary: true,
      problemStatement: true,
      chosenOption: true,
      rationale: true,
      alternativesConsidered: true,
      assumptions: true,
      risks: true,
      ownerUserId: true,
      _count: { select: { links: true, tags: true } },
    },
  });

  const trends = computeTrends(rows, { months });
  const quality = summarizeQuality(
    rows.map((r) => ({ ...r, linkCount: r._count.links, tagCount: r._count.tags })),
  );

  return NextResponse.json({ total: rows.length, ...trends, quality });
});
