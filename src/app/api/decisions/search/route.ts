import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { clientKey, searchLimiter } from "@/lib/rate-limit";
import { decisionVisibilityWhere } from "@/lib/tenant";
import { isPlatformAdmin } from "@/lib/auth-guards";
import { revalidateWorkspaceAccess } from "@/lib/access-control";
import { computeDecisionHealth } from "@/lib/decision-health";
import { clampIntParam } from "@/lib/utils";
import {
  buildWhere,
  describeQuery,
  matchesHealthFilter,
  parseSearchQuery,
} from "@/lib/search-query";

/** Candidates pulled before scoring - wide enough to re-rank meaningfully. */
const CANDIDATE_LIMIT = 100;
const DEFAULT_LIMIT = 12;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // This route reads workspace decisions, so it must honor live access too (it
  // predates withApi and calls getSession directly).
  if (!isPlatformAdmin(session.platformRole)) {
    const access = await revalidateWorkspaceAccess(session.userId, session.workspaceId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Rate limit per workspace + IP - search fans out across fields and is cheap to abuse.
  const rl = await searchLimiter.check(`${session.workspaceId}:${clientKey(req)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rl.headers },
    );
  }

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q")?.trim() ?? "";
  const limit = clampIntParam(searchParams.get("limit"), {
    min: 1,
    max: 50,
    fallback: DEFAULT_LIMIT,
  });

  // `q` is a small filter language ("status:approved owner:me database"), not
  // just free text - see lib/search-query.ts for the grammar.
  const parsed = parseSearchQuery(raw);

  // Tag filters are by name in the query but by id in the schema, so resolve the
  // workspace's tags only when the query actually mentions one.
  let tagIdsByName: Record<string, string> | undefined;
  const tagTerms = [...(parsed.include.tag ?? []), ...(parsed.exclude.tag ?? [])];
  if (tagTerms.length > 0) {
    const tags = await prisma.tag.findMany({
      where: { workspaceId: session.workspaceId },
      select: { id: true, name: true },
    });
    tagIdsByName = Object.fromEntries(tags.map((t) => [t.name.toLowerCase(), t.id]));
    for (const term of tagTerms) {
      if (!tagIdsByName[term.toLowerCase()]) {
        parsed.warnings.push(`No tag named "${term}" in this workspace.`);
      }
    }
  }

  const { where: queryWhere, healthFilter } = buildWhere(parsed, {
    userId: session.userId,
    tagIdsByName,
  });

  // Scope to the workspace AND honor per-decision visibility (workspace-visible
  // plus the caller's own private decisions). The query filters are ANDed on top
  // so search can't surface another member's private decision.
  const visibility = decisionVisibilityWhere(session);
  const where = { ...visibility, ...queryWhere };

  const needsHealth = healthFilter.include.length > 0 || healthFilter.exclude.length > 0;

  const raws = await prisma.decision.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      rationale: true,
      updatedAt: true,
      owner: { select: { name: true } },
      // Health is derived, so the inputs come along only when it's being filtered on.
      ...(needsHealth
        ? {
            ownerUserId: true,
            reviewDate: true,
            reviewedAt: true,
            _count: { select: { reviews: true } },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: needsHealth ? CANDIDATE_LIMIT : Math.max(CANDIDATE_LIMIT, limit),
  });

  type Row = (typeof raws)[number] & {
    ownerUserId?: string | null;
    reviewDate?: Date | null;
    reviewedAt?: Date | null;
    _count?: { reviews: number };
  };

  let candidates = raws as Row[];
  if (needsHealth) {
    const now = new Date();
    candidates = candidates.filter((d) =>
      matchesHealthFilter(
        computeDecisionHealth(
          {
            status: d.status,
            ownerUserId: d.ownerUserId ?? null,
            reviewDate: d.reviewDate ?? null,
            reviewedAt: d.reviewedAt ?? null,
            updatedAt: d.updatedAt,
            reviewCount: d._count?.reviews ?? 0,
          },
          now,
        ),
        healthFilter,
      ),
    );
  }

  // Score and re-rank against the free-text part of the query.
  const text = parsed.text;
  let decisions;
  if (text) {
    const ql = text.toLowerCase();
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const scored = candidates.map((d) => {
      const tl = d.title.toLowerCase();
      let score = 0;
      if (tl === ql) score += 10;
      else if (tl.startsWith(ql)) score += 6;
      else if (tl.includes(ql)) score += 4;
      // Rationale/body match is lower priority than title
      else score += 1;
      // Active status boost
      if (d.status !== "archived" && d.status !== "superseded") score += 2;
      // Recency boost
      if (now - new Date(d.updatedAt).getTime() < sevenDays) score += 1;
      return { ...d, _score: score };
    });
    decisions = scored
      .sort((a, b) => b._score - a._score || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit)
      .map(({ _score, ...d }) => { void _score; return d; });
  } else {
    decisions = candidates.slice(0, limit);
  }

  return NextResponse.json({
    decisions: decisions.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      rationale: d.rationale,
      updatedAt: d.updatedAt,
      owner: d.owner,
    })),
    total: candidates.length,
    describe: describeQuery(parsed),
    warnings: parsed.warnings,
  });
}
