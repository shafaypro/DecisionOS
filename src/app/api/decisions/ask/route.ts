import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAnthropicConfig } from "@/lib/anthropic";
import { logger } from "@/lib/logger";
import { askLimiter, mutationKey } from "@/lib/rate-limit";
import { withApi } from "@/lib/api-handler";
import { decisionVisibilityWhere } from "@/lib/tenant";
import { AskSchema, type AskInput } from "@/lib/schemas";
import {
  rankDecisions,
  buildSnippet,
  buildAskPrompt,
  extractCitedIndices,
  queryTokens,
  type RetrievableDecision,
} from "@/lib/decision-retrieval";

/** Upper bound on how many decisions we pull into memory to rank per query. */
const RETRIEVAL_POOL = 500;
/** How many top-ranked decisions become answer context / source cards. */
const TOP_K = 6;

// Asking is read-only, so every role (including viewers) may ask.
export const POST = withApi<AskInput>({ schema: AskSchema }, async ({ session, body }) => {
  // Rate limited per user since each call can drive a model request.
  const limit = await askLimiter.check(mutationKey(session));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You're asking too quickly. Give it a few seconds." },
      { status: 429, headers: limit.headers },
    );
  }

  const { question } = body;

  // Only decisions the asker is allowed to see: workspace-visible, plus their
  // own private ones. Strictly workspace-scoped - no cross-tenant leakage.
  const rows = await prisma.decision.findMany({
    where: decisionVisibilityWhere(session),
    select: {
      id: true,
      title: true,
      summary: true,
      category: true,
      status: true,
      outcomeStatus: true,
      problemStatement: true,
      chosenOption: true,
      rationale: true,
      alternativesConsidered: true,
      assumptions: true,
      risks: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: RETRIEVAL_POOL,
  });

  const ranked = rankDecisions(question, rows as RetrievableDecision[], TOP_K);
  const tokens = queryTokens(question);

  const sources = ranked.map((r, i) => ({
    index: i + 1,
    id: r.decision.id,
    title: r.decision.title,
    status: r.decision.status ?? "draft",
    category: r.decision.category ?? "other",
    snippet: buildSnippet(r.decision, tokens),
  }));

  // Nothing matched - return an empty result the UI can present cleanly.
  if (sources.length === 0) {
    return NextResponse.json({ mode: "empty", answer: null, sources: [], citedIndices: [] });
  }

  const resolved = await resolveAnthropicConfig(session.workspaceId);

  // No AI key configured → degrade gracefully to ranked semantic retrieval.
  // The feature still delivers value: the most relevant decisions, with snippets.
  if (!resolved) {
    return NextResponse.json({ mode: "search", answer: null, sources, citedIndices: [] });
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({
      apiKey: resolved.apiKey,
      ...(resolved.baseUrl ? { baseURL: resolved.baseUrl } : {}),
    });
    const { system, user } = buildAskPrompt(question, ranked.map((r) => r.decision));

    const message = await client.messages.create({
      model: resolved.model,
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: user }],
    });

    const answer = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
    if (!answer) {
      return NextResponse.json({ mode: "search", answer: null, sources, citedIndices: [] });
    }

    return NextResponse.json({
      mode: "answer",
      answer,
      citedIndices: extractCitedIndices(answer),
      sources,
      model: resolved.model,
    });
  } catch (err: unknown) {
    logger.error("ask_failed", {
      workspaceId: session.workspaceId,
      userId: session.userId,
      err: err instanceof Error ? err.message : String(err),
    });
    // Fall back to retrieval rather than failing the request outright - the user
    // still gets the most relevant decisions even when synthesis is unavailable.
    return NextResponse.json({ mode: "search", answer: null, sources, citedIndices: [] });
  }
});
