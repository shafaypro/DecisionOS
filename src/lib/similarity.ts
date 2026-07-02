/**
 * Token-overlap similarity for the re-decide detector.
 *
 * Pulled out of the route handler so it can be unit-tested without
 * standing up Prisma. Pure functions, no I/O.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "of", "to", "and", "or", "for", "on", "in", "with", "as",
  "is", "are", "be", "we", "our", "use", "using", "by", "at", "from", "vs",
  "should", "do", "did", "decision", "decide", "re",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return inter / union;
}

/**
 * Convenience: directly score two strings. Returns Jaccard similarity 0-1.
 */
export function similarity(a: string, b: string): number {
  return jaccard(new Set(tokenize(a)), new Set(tokenize(b)));
}

/** Threshold above which we surface the prior decision as a "did you mean" hit. */
export const SIMILARITY_THRESHOLD = 0.25;
