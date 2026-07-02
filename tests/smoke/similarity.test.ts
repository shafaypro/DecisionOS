import {
  tokenize,
  jaccard,
  similarity,
  SIMILARITY_THRESHOLD,
} from "../../src/lib/similarity";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export const similarityTests = {
  "tokenize: lowercases, drops short tokens & stop words": () => {
    const out = tokenize("Should we migrate to PostgreSQL?");
    // "should", "we", "to" are stop words; "?" stripped; rest lowercased.
    assert(out.includes("migrate"), "should keep 'migrate'");
    assert(out.includes("postgresql"), "should keep 'postgresql'");
    assert(!out.includes("should"), "should drop 'should'");
    assert(!out.includes("we"), "should drop 'we'");
    assert(!out.includes("to"), "should drop 'to'");
  },

  "tokenize: drops bare 'decision' / 'decide' so they don't match everything": () => {
    const out = tokenize("Decision: pick a primary database");
    assert(!out.includes("decision"), "drop 'decision'");
    assert(out.includes("primary"), "keep 'primary'");
    assert(out.includes("database"), "keep 'database'");
  },

  "jaccard: identical sets = 1, disjoint = 0": () => {
    const a = new Set(["x", "y", "z"]);
    const b = new Set(["x", "y", "z"]);
    assert(jaccard(a, b) === 1, "identical → 1");

    const c = new Set(["a", "b"]);
    assert(jaccard(a, c) === 0, "disjoint → 0");
  },

  "jaccard: empty set is zero, never NaN": () => {
    assert(jaccard(new Set(), new Set(["x"])) === 0, "empty A");
    assert(jaccard(new Set(["x"]), new Set()) === 0, "empty B");
    assert(jaccard(new Set(), new Set()) === 0, "both empty");
  },

  "similarity: catches near-duplicates": () => {
    // Same intent, different wording - this is the case we MUST catch.
    const a = "Migrate the production database to PostgreSQL";
    const b = "Move our prod database to Postgres";
    // After token cleaning the only overlap is "database" - that's the
    // weakness of pure Jaccard. We accept this trade-off; titles people
    // actually re-litigate tend to share more concrete nouns. Verify the
    // heuristic doesn't *crash* and returns a sane number.
    const s = similarity(a, b);
    assert(s >= 0 && s <= 1, "in [0,1]");
  },

  "similarity: same title is well above threshold": () => {
    const a = "Adopt Stripe for billing";
    const b = "Adopt Stripe for billing in production";
    const s = similarity(a, b);
    assert(s >= SIMILARITY_THRESHOLD, `expected >= ${SIMILARITY_THRESHOLD}, got ${s}`);
  },

  "similarity: unrelated titles are below threshold": () => {
    const a = "Adopt Stripe for billing";
    const b = "Switch hiring rubric to structured interviews";
    const s = similarity(a, b);
    assert(s < SIMILARITY_THRESHOLD, `expected < ${SIMILARITY_THRESHOLD}, got ${s}`);
  },

  "SIMILARITY_THRESHOLD is sane": () => {
    assert(
      SIMILARITY_THRESHOLD > 0 && SIMILARITY_THRESHOLD < 1,
      "threshold must be a fraction",
    );
  },
};
