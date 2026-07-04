/**
 * Smoke test runner - zero-dep test harness.
 *
 * Run with:  npx tsx tests/smoke/run.ts
 *
 * Each test file exports a default async function. Add imports below.
 * No jest/vitest - keeps the dep surface narrow. If we grow past ~20 tests
 * we should switch to vitest.
 */

import { slackHmacTests } from "./slack-hmac.test";
import { cryptoTests } from "./crypto.test";
import { rateLimitTests } from "./rate-limit.test";
import { decisionHealthTests } from "./decision-health.test";
import { similarityTests } from "./similarity.test";
import { graphLayoutTests } from "./graph-layout.test";
import { authGuardsTests } from "./auth-guards.test";
import { utilsTests } from "./utils.test";
import { reviewTokenTests } from "./review-token.test";
import { decisionRetrievalTests } from "./decision-retrieval.test";
import { sessionTests } from "./session.test";
import { apiFoundationTests } from "./api-foundation.test";
import { workspaceSummaryTests } from "./workspace-summary.test";
import { cronAuthTests } from "./cron-auth.test";
import { errorReportingTests } from "./error-reporting.test";
import { platformAuthTests } from "./platform-auth.test";
import { auditTests } from "./audit.test";
import { csvTests } from "./csv.test";
import { schemasTests } from "./schemas.test";
import { observabilityTests } from "./observability.test";
import { activityEventsTests } from "./activity-events.test";
import { notifyTests } from "./notify.test";

type TestFn = () => void | Promise<void>;
type Suite = { name: string; tests: Record<string, TestFn> };

/** Per-test timeout so a hung promise fails that test instead of the whole run. */
const TEST_TIMEOUT_MS = 10_000;
function withTimeout(fn: TestFn, label: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${TEST_TIMEOUT_MS}ms`)),
      TEST_TIMEOUT_MS,
    );
    Promise.resolve()
      .then(fn)
      .then(() => resolve(), reject)
      .finally(() => clearTimeout(timer));
    void label;
  });
}

const SUITES: Suite[] = [
  { name: "slack hmac", tests: slackHmacTests },
  { name: "crypto (AES-256-GCM + legacy compat)", tests: cryptoTests },
  { name: "rate limit", tests: rateLimitTests },
  { name: "decision health (DecisionOS-specific)", tests: decisionHealthTests },
  { name: "similarity / re-decide detector", tests: similarityTests },
  { name: "graph layout (decision graph)", tests: graphLayoutTests },
  { name: "auth guards (role gates)", tests: authGuardsTests },
  { name: "utils (slugify / format / tone)", tests: utilsTests },
  { name: "review token (magic-link JWT)", tests: reviewTokenTests },
  { name: "decision retrieval (Ask DecisionOS)", tests: decisionRetrievalTests },
  { name: "session (encrypted JWE cookie)", tests: sessionTests },
  { name: "api foundation (authorize + tenant scoping)", tests: apiFoundationTests },
  { name: "workspace summary (health + memory aggregate)", tests: workspaceSummaryTests },
  { name: "cron auth (CRON_SECRET gate)", tests: cronAuthTests },
  { name: "error reporting (PII/secret scrubber)", tests: errorReportingTests },
  { name: "platform auth (provider control plane)", tests: platformAuthTests },
  { name: "audit trail (catalog + secret redaction + attribution)", tests: auditTests },
  { name: "csv (export escaping + formula-injection guard)", tests: csvTests },
  { name: "schemas (zod validation + parseBody)", tests: schemasTests },
  { name: "observability (request-context correlation)", tests: observabilityTests },
  { name: "activity events (feed labels)", tests: activityEventsTests },
  { name: "notify (webhook senders)", tests: notifyTests },
];

async function main() {
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  for (const suite of SUITES) {
    console.log(`\n── ${suite.name} ──`);
    for (const [name, fn] of Object.entries(suite.tests)) {
      try {
        await withTimeout(fn, name);
        console.log(`  ✓ ${name}`);
        pass++;
      } catch (err) {
        console.log(`  ✗ ${name}`);
        console.log(`      ${(err as Error).message}`);
        fail++;
        failures.push(`${suite.name} > ${name}: ${(err as Error).message}`);
      }
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

export function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}

export function assertEqual<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) {
    throw new Error(msg ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
