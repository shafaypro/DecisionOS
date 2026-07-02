import {
  queryTokens,
  scoreDecision,
  rankDecisions,
  buildSnippet,
  buildDecisionContext,
  buildAskPrompt,
  extractCitedIndices,
  ASK_SYSTEM_PROMPT,
  type RetrievableDecision,
} from "../../src/lib/decision-retrieval";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const AUTH: RetrievableDecision = {
  id: "d_auth",
  title: "Move auth from Auth0 to a custom JWT layer",
  summary: "Replace the vendor auth provider with an in-house session layer.",
  status: "approved",
  category: "engineering",
  outcomeStatus: "successful",
  problemStatement: "Auth0 per-MAU pricing balloons as we pass 50k users.",
  chosenOption: "Build a custom JWT session layer encrypted with jose.",
  rationale: "Full control of the session payload and no per-seat vendor pricing.",
  alternativesConsidered: "Stay on Auth0; migrate to Clerk; migrate to WorkOS.",
  updatedAt: "2026-01-10T00:00:00Z",
};

const DB: RetrievableDecision = {
  id: "d_db",
  title: "Adopt PostgreSQL as the primary production database",
  status: "approved",
  category: "engineering",
  rationale: "Postgres gives us JSONB, strong indexing, and a managed path on every cloud.",
  updatedAt: "2026-02-01T00:00:00Z",
};

const HIRING: RetrievableDecision = {
  id: "d_hire",
  title: "Switch to structured interview rubrics for hiring",
  status: "archived",
  category: "hiring",
  rationale: "Structured rubrics reduce bias and make candidate comparisons fairer.",
  updatedAt: "2025-12-01T00:00:00Z",
};

const CORPUS = [AUTH, DB, HIRING];

export const decisionRetrievalTests = {
  "queryTokens: dedupes and drops stop words": () => {
    const t = queryTokens("Why did we move off Auth0 and off Auth0 again?");
    assert(t.includes("auth0"), "keeps 'auth0'");
    assert(t.includes("move"), "keeps 'move'");
    assert(t.filter((x) => x === "auth0").length === 1, "deduped 'auth0'");
    assert(!t.includes("we"), "drops stop word 'we'");
  },

  "scoreDecision: a title hit outscores a body-only hit": () => {
    const tokens = queryTokens("auth0 provider");
    const strong = scoreDecision(tokens, AUTH).score;
    const weak = scoreDecision(tokens, DB).score;
    assert(strong > weak, `title match (${strong}) should beat non-match (${weak})`);
  },

  "scoreDecision: no token overlap → score 0, no spurious boost": () => {
    const tokens = queryTokens("marketing budget allocation");
    const { score, matchedTokens } = scoreDecision(tokens, AUTH);
    assert(score === 0, `expected 0, got ${score}`);
    assert(matchedTokens.length === 0, "no matched tokens");
  },

  "scoreDecision: empty query never matches": () => {
    assert(scoreDecision([], AUTH).score === 0, "empty query → 0");
  },

  "rankDecisions: returns the relevant decision first, drops irrelevant ones": () => {
    const ranked = rankDecisions("why did we move off Auth0?", CORPUS);
    assert(ranked.length >= 1, "at least one hit");
    assert(ranked[0].decision.id === "d_auth", `expected d_auth first, got ${ranked[0].decision.id}`);
    assert(!ranked.some((r) => r.decision.id === "d_hire"), "unrelated hiring decision excluded");
  },

  "rankDecisions: respects the limit": () => {
    const ranked = rankDecisions("postgres auth database rubric interview", CORPUS, 2);
    assert(ranked.length <= 2, `expected <= 2, got ${ranked.length}`);
  },

  "rankDecisions: empty query / empty corpus → empty": () => {
    assert(rankDecisions("", CORPUS).length === 0, "empty query");
    assert(rankDecisions("auth0", []).length === 0, "empty corpus");
  },

  "rankDecisions: deterministic ordering on repeated runs": () => {
    const a = rankDecisions("database postgres auth0", CORPUS).map((r) => r.decision.id);
    const b = rankDecisions("database postgres auth0", CORPUS).map((r) => r.decision.id);
    assert(JSON.stringify(a) === JSON.stringify(b), "ordering must be stable");
  },

  "buildSnippet: excerpt contains a query term": () => {
    const snip = buildSnippet(AUTH, queryTokens("pricing"), 120).toLowerCase();
    assert(snip.includes("pricing"), `snippet should mention the matched term: ${snip}`);
  },

  "buildSnippet: falls back to summary/title when nothing matches": () => {
    const snip = buildSnippet(DB, queryTokens("unrelated zebra"), 120);
    assert(snip.length > 0, "non-empty fallback snippet");
  },

  "buildDecisionContext: numbers records and includes titles + reasoning": () => {
    const ctx = buildDecisionContext([AUTH, DB]);
    assert(ctx.includes("[1]"), "first record numbered");
    assert(ctx.includes("[2]"), "second record numbered");
    assert(ctx.includes("Auth0"), "includes the first title");
    assert(ctx.includes("Rationale:"), "includes a labeled reasoning field");
  },

  "buildDecisionContext: caps long fields so the prompt stays bounded": () => {
    const huge: RetrievableDecision = { id: "x", title: "T", rationale: "x".repeat(5000) };
    const ctx = buildDecisionContext([huge], 100);
    assert(ctx.length < 400, `field should be truncated, got length ${ctx.length}`);
    assert(ctx.includes("…"), "truncation marker present");
  },

  "buildAskPrompt: carries the question and instructs grounded citation": () => {
    const { system, user } = buildAskPrompt("Why did we move off Auth0?", [AUTH]);
    assert(system === ASK_SYSTEM_PROMPT, "uses the static system contract");
    assert(/cite|citing|bracket/i.test(system), "system prompt demands citations");
    assert(user.includes("Why did we move off Auth0?"), "user prompt includes the question");
    assert(user.includes("[1]"), "user prompt includes numbered context");
  },

  "extractCitedIndices: parses, dedupes and sorts bracket citations": () => {
    const cited = extractCitedIndices("The team chose this [2] over the alternative [1], see [2].");
    assert(JSON.stringify(cited) === JSON.stringify([1, 2]), `got ${JSON.stringify(cited)}`);
  },

  "extractCitedIndices: no citations → empty": () => {
    assert(extractCitedIndices("No brackets here at all.").length === 0, "no citations");
  },
};
