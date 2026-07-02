import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { clientKey, searchLimiter } from "@/lib/rate-limit";
import { decisionVisibilityWhere } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Rate limit per workspace + IP - search fans out across fields and is cheap to abuse.
  const rl = await searchLimiter.check(`${session.workspaceId}:${clientKey(req)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rl.headers },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  // Scope to the workspace AND honor per-decision visibility (workspace-visible
  // plus the caller's own private decisions). The text match is ANDed on top so
  // search can't surface another member's private decision.
  const visibility = decisionVisibilityWhere(session);
  const where = q
    ? {
        ...visibility,
        AND: [
          {
            OR: [
              { title: { contains: q } },
              { rationale: { contains: q } },
              { problemStatement: { contains: q } },
              { chosenOption: { contains: q } },
            ],
          },
        ],
      }
    : visibility;

  const raw = await prisma.decision.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      rationale: true,
      updatedAt: true,
      owner: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  // Score and re-rank when a query is present
  let decisions;
  if (q) {
    const ql = q.toLowerCase();
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const scored = raw.map((d) => {
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
      .slice(0, 12)
      .map(({ _score, ...d }) => { void _score; return d; });
  } else {
    decisions = raw.slice(0, 12);
  }

  return NextResponse.json({ decisions });
}
