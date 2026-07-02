import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/api-handler";
import { decisionVisibilityWhere } from "@/lib/tenant";
import { clientKey, searchLimiter } from "@/lib/rate-limit";
import { tokenize, jaccard, SIMILARITY_THRESHOLD } from "@/lib/similarity";

/**
 * GET /api/decisions/similar?q=<title>
 *
 * "Re-decide detector": when a user starts typing a new decision title, we
 * surface existing decisions in the workspace that look semantically close
 * - so they don't accidentally re-litigate the same thing two quarters
 * later (the third pain card on the landing page).
 *
 * No vector store, no embeddings - just a token-overlap heuristic. Cheap,
 * deterministic, surprisingly effective for short titles. If we add an
 * embeddings backend later, this endpoint stays the same.
 */

export const GET = withApi<undefined>({ require: "auth" }, async ({ session, req }) => {
  // Same limiter as /search - fans out across rows; keep it cheap to call.
  const rl = await searchLimiter.check(`${session.workspaceId}:${clientKey(req)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rl.headers },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const queryTokens = new Set(tokenize(q));
  if (queryTokens.size === 0) return NextResponse.json({ matches: [] });

  // Pull active decisions the caller may see (workspace + own private), excluding
  // superseded/archived - those are already replaced/closed, not a re-decide risk.
  const candidates = await prisma.decision.findMany({
    where: {
      ...decisionVisibilityWhere(session),
      status: { notIn: ["archived", "superseded"] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      rationale: true,
      updatedAt: true,
      owner: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 250, // sane cap; workspaces with more than this can still match top-N
  });

  const scored = candidates
    .map((c) => {
      const titleTokens = new Set(tokenize(c.title));
      const rationaleTokens = new Set(tokenize((c.rationale ?? "").slice(0, 400)));
      const titleScore = jaccard(queryTokens, titleTokens);
      const rationaleScore = jaccard(queryTokens, rationaleTokens) * 0.5; // title weighs more
      const score = Math.max(titleScore, rationaleScore);
      return { decision: c, score };
    })
    .filter((x) => x.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return NextResponse.json({
    matches: scored.map((s) => ({
      id: s.decision.id,
      title: s.decision.title,
      status: s.decision.status,
      ownerName: s.decision.owner?.name ?? null,
      updatedAt: s.decision.updatedAt,
      score: Math.round(s.score * 100),
    })),
  });
});
