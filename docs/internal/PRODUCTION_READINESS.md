# DecisionOS - Production-Readiness Audit & Phased Roadmap

> Senior-engineering deep review. Grounded in the actual code as of the `Ask DecisionOS` + bring-your-own-model merge. Supersedes the earlier `AUDIT_REPORT.md` for the AI-era codebase.
> File/line references are concrete so each item is actionable.

---

## 📊 SYSTEM OVERVIEW

**Product.** DecisionOS is a B2B multi-tenant SaaS "system of record for decisions" - capture *what/why/alternatives/assumptions/risks*, run scheduled outcome reviews, and (new) ask the decision log natural-language questions with cited answers. Adjacent surfaces: decision graph, analytics, action-item board, Slack capture bot, Stripe billing, OIDC SSO, email/Slack/Teams notifications.

**Architecture style.** Modular **monolith** on **Next.js 16 (App Router, Turbopack)** - RSC pages for reads, REST route handlers (`src/app/api`, 46 routes) for all mutations (a deliberate workaround for a Turbopack 16.2 server-action bug). Deployable as a single container; horizontally scalable behind an ALB.

**Stack.**
- Frontend: React 19 RSC + client components, Tailwind v4, Radix UI, Storybook (25 stories).
- Backend: Next route handlers; pure business logic in `src/lib` (27 modules).
- Data: Prisma v7 with driver adapters - **Postgres in prod** (`@prisma/adapter-pg`), **SQLite/libsql in dev** (client generated to `src/generated/prisma`).
- Auth: custom JWT (`jose`, HS256) cookie sessions; `proxy.ts` route guard; OIDC SSO; bcrypt(12).
- Infra: multi-stage `Dockerfile`, Terraform for **AWS ECS** (ALB + ElastiCache Redis + RDS) and **GCP free-tier**; GitHub Actions CI (lint/type-check/smoke/build + `npm audit`).
- Cross-cutting: AES-256-GCM secret encryption (`crypto.ts`), token-bucket rate limiter (in-memory→Redis), structured JSON logger + `AsyncLocalStorage` request context.

**Core data model.** 24 Prisma models. `Workspace 1-* WorkspaceMembership *-1 User`; `Decision` is the hub (notes, replies, links, reviews, events/audit, versions, typed relations, tags, reactions, watchers, action items). Tenancy key is `workspaceId` on every workspace-owned row.

**Assumptions (stated explicitly):**
- A1: Production runs the committed Postgres schema (CI/dev exercise SQLite only - see DevOps).
- A2: `SESSION_SECRET`, `ANTHROPIC_*`, `STRIPE_*`, SMTP creds are injected via the platform secret store (ECS `secrets.tf`), not committed.
- A3: A single Postgres instance backs all tenants (no per-tenant DB / sharding today).

---

## ⚠️ KEY FINDINGS (by category)

### Architecture
- **Tenant isolation is application-enforced only.** Every query manually appends `workspaceId`; there is no Postgres Row-Level Security and no shared query wrapper. One forgotten filter = cross-tenant leak. This is the single largest structural risk.
- **No service/domain layer.** Business logic lives directly in 46 route handlers *and* RSC pages (e.g., `analytics/page.tsx` computes pattern analysis inline; `supersede` orchestrates a transaction in the route). Logic isn't reusable or unit-testable without HTTP.
- **Per-route boilerplate.** `getSession` → role guard → rate-limit → `parseBody` is hand-rolled in every route with subtle inconsistencies (some check viewers, some don't). No `withAuth()/withValidation()` composition.
- **Dead code.** `src/actions/{decisions,team,settings,tags}.ts` are legacy server actions "kept for reference," superseded by API routes.

### Code Quality
- Strong baseline: TS strict, named exports, Zod schemas centralized (`lib/schemas.ts`), pure logic isolated in `lib/` with smoke tests.
- Hotspots: generated Prisma client aside, the heaviest hand-written files are RSC pages doing data + derivation + presentation in one component (decision detail, analytics) - hard to test, easy to regress.
- Validation coverage is uneven: newer routes use Zod; several older ones still read `await req.json()` untyped (e.g., `integrations` before this PR, `archive`, tag assignment).

### Security
- ✅ Solid: security headers + HSTS (`next.config.ts`), AES-256-GCM for integration/SSO/Slack secrets with per-record salt, Stripe webhook HMAC + replay window + `timingSafeEqual`, Slack HMAC (smoke-tested), bcrypt(12), no user-enumeration on **login**, `/api/seed` gated to non-prod.
- 🔴 **No brute-force protection on `login()`** (`src/actions/auth.ts`) - unlimited password attempts, no lockout/backoff/captcha. The rate limiter exists but isn't applied here.
- 🟠 **Sessions are *signed*, not *encrypted*.** `lib/session.ts` uses `SignJWT`/`jwtVerify` (HS256). `CONTRIBUTING.md`/README claim "JWE/A256GCM encryption." The cookie payload (`userId, workspaceId, role, email, name`) is base64-readable. Tamper-proof, but the "encrypted" claim is false → compliance/trust risk.
- 🟡 **Signup leaks account existence** ("An account with this email already exists" - `auth.ts:29`).
- 🟡 **CSP allows `'unsafe-inline' 'unsafe-eval'`** for scripts (`next.config.ts:21`) - weakens XSS defense.

### Performance
- ✅ Schema is well-indexed, including composite indexes matching real access patterns (`Decision @@index([workspaceId,status,updatedAt])`, cron review index, notification feed index).
- 🟠 **Unbounded in-memory scans.** `analytics/page.tsx` `findMany` loads *all* workspace decisions (no `take`) and loops in JS for health/pattern stats. Fine at free-tier (200), linear blowup for large/enterprise tenants.
- 🟡 **No HTTP/data caching.** Dashboards/analytics recompute on every request; no `unstable_cache`/tag revalidation, no CDN caching of the public `/share` page.
- 🟡 **N+1 watch points** in fan-out paths (`notify-watchers`, activity feeds) - currently bounded but unguarded as data grows.

### DevOps / Deployment
- ✅ Multi-stage Docker, non-root user, healthcheck route, Terraform for two clouds, CI with concurrency cancel.
- 🟠 **CI never exercises Postgres.** It generates the SQLite client and builds against `file:./dev.db`. Postgres-specific migration/query issues (the prod target) are invisible to CI.
- 🟠 **Runner image ships dev dependencies.** `Dockerfile` copies the full `deps` `node_modules` (Storybook, Playwright, ESLint, tsx…) into the runtime image. No `output: "standalone"`. Bloated image, larger attack surface, slower cold starts.
- 🟠 **Migrations run per-replica at startup** (`CMD … db:migrate:deploy && npm run start`). With >1 ECS task this races; should be a one-shot pre-deploy job / init task.
- 🟡 **Observability stops at logs.** Great structured logs + correlation IDs, but no metrics, no distributed tracing (OTel), no error tracker (Sentry), no uptime/SLO alerting.

### Testing
- 🔴 **Automated coverage is pure-function smoke only** (11 suites via a custom zero-dep runner). **0 of 46 API routes** have integration tests; **0 E2E** (note: `playwright-core` is a dependency but unused); no RSC/component tests (a11y addon present, no test runner). For a billing-and-tenant-isolation SaaS this is the top reliability gap.
- 🟡 No test for the **Stripe webhook** custom-crypto verifier (a correctness-critical, hand-rolled HMAC).
- 🟡 CI lacks coverage thresholds and a migration-drift check.

### Database
- ✅ Cascades modeled, unique constraints for idempotency (reactions, relations, tags, memberships), sensible indexes.
- 🟡 **JSON-as-string denormalization**: `Decision.consultedIds` (and `*Json` audit/version blobs) can't be queried/joined; RACI "consulted" can't be filtered server-side.
- 🟡 **Unbounded append-only tables** (`AnalyticsEvent`, `NotificationLog`, `DecisionEvent`, `DecisionVersion`) with no retention/partitioning/TTL → cost + slow scans over time.
- 🟡 No FK index on `ActionItem.createdById` / a few creator FKs used in activity queries.

---

## 🚨 ISSUE LIST (PRIORITIZED)

| # | Title | Sev | Status | Location | Impact |
|---|---|---|---|---|---|
| 1 | No login brute-force protection | 🔴 | ✅ Fixed (T0.1) | `src/actions/auth.ts` | Credential stuffing & password spraying against all tenants |
| 2 | Tenant isolation is convention-only (no RLS / no shared scoper) | 🔴 | 🟡 Mitigated (T1.2 helpers + tests; no RLS yet) | all `api/*`, `prisma.ts` | Cross-tenant data breach; the worst-case SaaS failure |
| 3 | No integration/E2E tests on routes incl. billing & auth | 🔴 | 🟡 Partial (41 integration tests; no E2E; SQLite not PG) | `tests/` | Regressions in money/tenancy paths ship silently |
| 4 | Migrations run per-replica at container start | 🟠 | ✅ Fixed (T0.2 migrator) | `Dockerfile` | Deploy-time races / partial migrations / downtime |
| 5 | Runner image includes dev dependencies; no standalone output | 🟠 | ✅ Fixed (T0.3 prod-deps) | `Dockerfile` | Large image, slow cold start, bigger attack surface |
| 6 | CI doesn't test the Postgres target | 🟠 | ⬜ TODO (integration runs on SQLite) | `.github/workflows/ci.yml` | Prod-only Postgres bugs escape CI |
| 7 | Session "encryption" claim is false (signed, not encrypted) | 🟠 | ✅ Fixed (T0.4 real JWE) | `src/lib/session-crypto.ts` | Compliance misstatement; role/email exposure in cookie |
| 8 | Unbounded in-memory analytics scan | 🟠 | ⬜ TODO (Phase 2) | `src/app/(app)/analytics/page.tsx` | Latency/memory blow-up for large tenants |
| 9 | No service/domain layer; logic in routes & pages | 🟠 | 🟡 Partial (withApi/tenant foundations) | `api/*`, RSC pages | Slows every future change; raises regression rate |
| 10 | Per-route auth/validation boilerplate & drift | 🟠 | ✅ Fixed (withApi across all session-auth app routes) | `api/*` | Inconsistent guards → authz holes |
| 11 | Unbounded append-only tables (no retention) | 🟡 | ⬜ TODO (Phase 2) | `schema.prisma` | Storage cost + slowing scans |
| 12 | Signup user-enumeration | 🟡 | 🟡 Mitigated (rate-limited; message still enumerates) | `src/actions/auth.ts` | Account discovery |
| 13 | CSP allows `unsafe-inline`/`unsafe-eval` | 🟡 | ⬜ TODO (Phase 4) | `next.config.ts` | Weakened XSS mitigation |
| 14 | Stripe webhook verifier untested | 🟡 | ⬜ TODO | `api/billing/webhook/route.ts` | A bad refactor could accept forged events |
| 15 | Dead legacy server actions | 🟡 | ✅ Fixed (T1.4) | `src/actions/*` | Confusion, accidental reuse |
| 16 | No metrics/tracing/error-tracking | 🟡 | ⬜ TODO (Phase 4) | platform | Slow MTTR; no SLOs/alerts |
| 17 | JSON-string denormalization (`consultedIds`) | 🟢 | ⬜ TODO (Phase 5) | `schema.prisma` | Limits future filtering features |
| ➕ | Visibility leaks in `search` / `similar` / `export` | 🟠 | ✅ Fixed (T1.2) | `api/decisions/{search,similar,export}` | Members could see others' private decisions (found during rollout) |
| ➕ | `bulk` / `export` rate limiters defined but unused | 🟡 | ✅ Fixed (T0/T1) | `api/decisions/{bulk,export}` | Heavy endpoints were not throttled |
| ➕ | Custom / company model integration (BYO endpoint + tool-calling) | 🟢 | ⬜ TODO (Phase 6) | `src/lib/ai`, `api/integrations` | Enterprise fit: let teams use in-house / compliance-approved models |
| ➕ | Local open-source model support (run-locally endpoints, downloadable small models) | 🟢 | ⬜ TODO (Phase 6) | `src/lib/ai`, `schemas.ts` | Data residency / air-gapped / zero-cost inference |

---

## 🧭 PHASED ROADMAP

> **Status legend:** ✅ done · 🟡 partial / in progress · ⬜ TODO. Updated as the
> work lands on branch `claude/admiring-allen-q97iqi` (PR #26).

### Phase 0 - Stabilization (security & deploy correctness) - ✅ DONE
- ✅ **T0.1** Rate-limit `login()` (per ip+email and per ip) and `signup()` (per ip) via `lib/rate-limit.ts` + `headers()`. *(Issue 1)*
- ✅ **T0.2** Migrations moved out of the per-replica `CMD` into a dedicated one-shot **`migrator`** image; GCP compose runs it as a gated one-shot, ECS pattern documented. *(Issue 4)*
- ✅ **T0.3** Slim runtime image via a `prod-deps` (`npm ci --omit=dev`) stage - no dev deps in the runner (chosen over `output:"standalone"` to keep the Prisma CLI for the migrator). *(Issue 5)*
- ✅ **T0.4** Sessions are now truly **encrypted** (`EncryptJWT`/`dir`+A256GCM) in `lib/session-crypto.ts`; matches the docs. *(Issue 7)*
- 🟡 **T0.5** Signup is now rate-limited (mitigates automated enumeration); the distinct "already exists" **message is still shown** - making it fully non-enumerating is still TODO. *(Issue 12)*
- ➕ **Bonus** CI **Docker image build** job added (also fixed a pre-existing builder break: build against a `postgres://` URL so client/adapter match).

### Phase 1 - Architecture & Structure - 🟡 IN PROGRESS
- ⬜ **T1.1** Thin **service layer** (`src/server/<domain>/`) - not started (the `withApi` wrapper + tenant helpers are the foundation it would build on). *(Issue 9)*
- ✅ **T1.2** **Tenant scoping** (`src/lib/tenant.ts`: `workspaceWhere` / `decisionVisibilityWhere` / `sameWorkspace`), adopted across migrated routes. Surfaced & fixed **3 real visibility leaks** (`search`, `similar`, `export`). *(Issue 2)*
- ✅ **T1.3** `withApi` wrapper + pure `authorizeRole` ✅ built; **rollout complete across every session-authenticated app route**. The final admin/workspace batch - tags CRUD, team, settings, settings/sso, templates (+`[id]`), action-items (+`[id]`), notifications, integrations - now goes through `withApi` (auth → authorize → validate → centralized try/catch). New body schemas (`TagWriteSchema`/`TagDeleteSchema`, `WorkspaceSettingsSchema`, `TeamInviteSchema`, typed `TemplateWriteSchema`) replace untyped `req.json()`. Behaviour preserved: rate-limit-first ordering on team invites, the SSO form-encoded POST + enterprise gate + redirect, integrations secret-masking, and action-item partial PATCH semantics. Webhook/cron/Slack/public-auth routes (billing, cron, slack/\*, auth/sso) keep their own HMAC/cron-secret guards by design. *(Issue 10)*
- ✅ **T1.4** Deleted legacy `src/actions/{decisions,team,settings,tags}.ts`. *(Issue 15)*

### Phase 2 - Core Improvements (perf & data) - ⬜ TODO
- ⬜ **T2.1** Replace in-memory analytics scans with SQL aggregates. *(Issue 8)*
- ⬜ **T2.2** `unstable_cache` + tag revalidation for dashboard/analytics; edge-cache `/share/:id`. *(Performance)*
- ⬜ **T2.3** Retention/rollup for append-only tables. *(Issue 11)*
- ⬜ **T2.4** N+1 audit on fan-out paths.

### Phase 3 - Testing & Reliability - 🟡 IN PROGRESS
- 🟡 **T3.1** **Vitest** harness ✅ + **41 integration tests** ✅ (tenancy, visibility, role authz, supersede, and the admin/workspace routes: tags, templates, action-items, settings, team, integrations). Run against **SQLite**, not yet a Postgres test container; billing-webhook test still TODO. *(Issues 3, 14)*
- ⬜ **T3.2** Playwright **E2E** for golden paths. *(Issue 3)*
- 🟡 **T3.3** CI runs the integration step ✅ - but on SQLite; **Postgres matrix + coverage thresholds + `prisma migrate diff`** still TODO. *(Issue 6)*
- 🟡 **T3.4** Centralized error handling - `withApi` now wraps every migrated route in try/catch → sanitized 500 + logged; a global boundary for the rest is TODO.

### Phase 4 - Scalability & Production Hardening - ⬜ TODO
- ⬜ **T4.1** Make Redis mandatory in prod; shared cache; assert `REDIS_URL` at boot.
- ⬜ **T4.2** OpenTelemetry traces+metrics + Sentry; RED/USE dashboards + SLO alerts. *(Issue 16)*
- ⬜ **T4.3** Tighten CSP via nonces; remove `unsafe-eval`. *(Issue 13)*
- ⬜ **T4.4** Background-job queue for emails/Slack/AI; idempotent webhook processing.
- ⬜ **T4.5** k6 load test; autoscaling targets.

### Phase 5 - Developer Experience & Cleanup - ⬜ TODO
- ⬜ **T5.1** Pre-commit hooks + PR template.
- ⬜ **T5.2** Postgres-backed local dev parity.
- ⬜ **T5.3** Schema-generated API reference; ADRs.
- ⬜ **T5.4** Shared enums; relational `consultedIds`. *(Issue 17)*

### Phase 6 - AI & Model Extensibility (bring-your-own-model) - ⬜ TODO

> Today the only AI provider is the `anthropic` integration (`AnthropicConfigSchema`:
> `apiKey` + `model` + Anthropic-compatible `baseUrl`). This phase generalizes that into
> a provider registry so a workspace can plug in **its own company model** *and* run
> **fully-local open-source models** - with the tool able to call those models and the
> models able to call back into the decision log under tenant-scoped guards.

- ⬜ **T6.1** **Generalized provider registry.** Promote the single `anthropic` integration into a per-workspace provider record (`provider` type, `baseUrl`, auth scheme/header, `model` id, optional org/project). Reuse the existing AES-256-GCM secret encryption and the secret-masking already in `api/integrations`. Adapters for OpenAI-compatible, Anthropic-compatible, and a generic "custom HTTP" shape. *Location:* `src/lib/schemas.ts` (`AnthropicConfigSchema` → `ProviderConfigSchema`), `src/app/api/integrations`, new `src/lib/ai/providers/`.
- ⬜ **T6.2** **Custom company-model connector.** Let an enterprise register their own internal/hosted model endpoint (e.g. a gateway in their VPC) so it can power Ask / draft / similarity - including private/compliance-gated models that may never see a public API. Per-workspace base URL + auth, capability flags, and a model-id allow-list. *Location:* `src/lib/ai/providers/custom.ts`, Settings → AI.
- ⬜ **T6.3** **Tool / function-calling bridge (model ↔ tool).** Expose DecisionOS capabilities (search/retrieve, draft a decision, log a note, schedule a review) as callable tools so a connected model can *communicate with the tool* - query the decision log, propose decisions, trigger reviews. **Every tool call routes through `withApi` + tenant scoping** so a model can never read or mutate across workspaces. *Location:* `src/lib/ai/tools/`, `src/app/api/decisions/ask`.
- ⬜ **T6.4** **Local / open-source model endpoints (run-locally).** Allow a workspace to point at a locally-run inference server (Ollama / llama.cpp / vLLM / LM Studio) on `http://localhost:*` or a private-LAN URL. Data never leaves the host/network - the app only calls the endpoint. Relax the `baseUrl` validator to permit loopback/private hosts **only** when a `local` provider type is selected, and call local endpoints from a trusted runtime (no blind server-side proxy of arbitrary local URLs). *Location:* `src/lib/schemas.ts` (`baseUrl` refine + provider-type enum), `src/lib/ai/providers/local.ts`.
- ⬜ **T6.5** **Downloadable small models for the self-hosted edition.** In the OSS/self-hosted build, add an opt-in helper to pull a small model (e.g. a 1-3B GGUF) and a managed local runtime, surfaced under Settings → AI. Strictly local: the download and all inference stay on the host; the hosted SaaS build keeps this behind a feature flag and off by default. *Location:* `scripts/` model-pull helper, `docs/SETUP.md`, Settings → AI UI, `src/lib/plans.ts` gate.
- ⬜ **T6.6** **Provider health + capability probe.** A "Test connection" action that pings the endpoint, reports latency + resolved model id, and records capability flags (streaming, tool-calling, context window) before save - so misconfig fails loudly, not at first use. *Location:* `src/app/api/integrations`, Settings → AI.
- ⬜ **T6.7** **Guardrails for BYO providers.** Per-workspace token/cost ceilings, request timeouts, secret redaction in logs, and an **egress policy**: cloud providers restricted to an allow-list of hosts; `local` providers loopback/private-only. *Location:* `src/lib/ai/`, `src/lib/rate-limit.ts`.
- ⬜ **T6.8** **Open-source edition packaging.** Ship an OSS distribution where AI defaults to a local provider (no external keys required to use Ask/draft), with a clear hosted-vs-self-hosted feature matrix. *Location:* `docs/`, `src/lib/plans.ts`.

---

## 🧱 REFACTORING STRATEGY (safe, incremental)

1. **Tests first where you'll change behavior.** Before T1/T2 refactors, land T3.1 integration tests for the routes you'll touch (tenancy + authz + the specific endpoint). The refactor then has a safety net.
2. **Strangler pattern for the service layer.** Extract logic into `src/server/<domain>` and have the existing route call it - identical I/O - then refactor internals. No behavior change per step.
3. **Tenant scoper via parallel adoption.** Introduce `forWorkspace()` and migrate routes one at a time behind tests; add a lint rule / code-review checklist that bare `prisma.decision.*` in `api/*` is disallowed.
4. **Order of operations:** Phase 0 (security/deploy) → tests for hot paths → architecture (scoper + wrappers) → perf/data → reliability → scale. Security and deploy-race fixes are low-risk and unblock confident iteration.
5. **Risk mitigation:** ship behind small PRs with the existing CI gate; add the Postgres CI matrix early (T3.3) so every later change is validated against the real engine; feature-flag the analytics SQL rewrite and compare outputs against the in-memory version before deleting it.
6. **Never break prod tenancy:** treat T1.2 as security-critical - pair-review, and add an integration test asserting workspace A cannot read/mutate workspace B for *every* migrated route.

---

## 📈 QUICK WINS (<1 day each)
- ✅ Login (+signup) rate-limiting (T0.1).
- ✅ `npm ci --omit=dev` slim runner (T0.3).
- ✅ Real session encryption (T0.4) - did the encryption rather than the doc-only fix.
- ✅ Delete `src/actions/*` legacy files (T1.4).
- ⬜ Generic signup message (T0.5 - still enumerates).
- ⬜ Add a Stripe-webhook HMAC smoke test mirroring `slack-hmac`.
- ⬜ Add `prisma migrate diff` drift check to CI.
- ⬜ Add `poweredByHeader:false` and a `/api/health` deep check (DB ping).
- ⬜ Retention cron for `AnalyticsEvent`/`NotificationLog`.

---

## 🧩 ADDITIONAL IMPROVEMENT BACKLOG

> Running list of features & improvements beyond the production-readiness audit.
> Append freely - items graduate into a numbered phase once scoped.

### AI & model extensibility (see Phase 6)
- ⬜ Generalize the `anthropic` integration into a multi-provider registry (OpenAI-compatible / Anthropic-compatible / custom HTTP).
- ⬜ **Custom company-model integration** - register an in-house / VPC-hosted model endpoint so teams can use their own compliance-approved model with the tool.
- ⬜ **Two-way tool/function-calling** - let the connected model call DecisionOS (search, draft, note, schedule review) through tenant-scoped `withApi` guards.
- ⬜ **Local open-source models** - point at a locally-run endpoint (Ollama / llama.cpp / vLLM / LM Studio); inference stays on the host/LAN, app only calls the endpoint.
- ⬜ **Downloadable small models** for the self-hosted edition (pull a 1-3B GGUF + managed local runtime), strictly local, behind a feature flag in the SaaS build.
- ⬜ Per-provider "Test connection" health/capability probe (latency, model id, streaming/tool-calling/context-window flags).
- ⬜ BYO-provider guardrails - token/cost ceilings, timeouts, secret redaction, egress allow-list (cloud) vs loopback-only (local).
- ⬜ Open-source edition that defaults to a local provider (no external keys needed) + hosted-vs-self-hosted feature matrix.
- ⬜ Streaming responses for Ask (SSE) across all provider types.
- ⬜ Prompt/response audit log per workspace (opt-in), with retention controls, for AI governance.
- ⬜ Model-output citation verification - assert every cited decision id belongs to the caller's workspace before rendering.

### Product & platform
- ⬜ Decision templates marketplace / shareable template export-import.
- ⬜ Webhook/outbound events API so external systems can subscribe to decision lifecycle changes.
- ⬜ Public REST/GraphQL API + scoped API keys for programmatic decision capture.
- ⬜ Bulk import (CSV / Notion / Confluence) for decision backfill.
- ⬜ Saved views & advanced filters (by owner, impact, outcome, tag) with shareable URLs.
- ⬜ Per-workspace data export / account deletion (GDPR self-service).
- ⬜ Audit-log UI for admins (who changed what, when) built on existing `DecisionEvent`/`*Json` blobs.

### Engineering & hardening
- ⬜ Row-Level Security in Postgres as defense-in-depth behind the app-level tenant scoper (Issue 2).
- ⬜ Extract the service/domain layer (Phase 1 T1.1) and move RSC-page business logic into it.
- ⬜ Postgres CI matrix + coverage thresholds + `prisma migrate diff` drift gate (Phase 3).
- ⬜ Playwright E2E for golden paths incl. the Stripe money path (Phase 3 T3.2).
- ⬜ OpenTelemetry traces/metrics + Sentry; RED/USE dashboards + SLO alerts (Issue 16).
- ⬜ Background-job queue for emails/Slack/AI calls; idempotent webhook processing (Phase 4 T4.4).

---

## 🧠 FINAL RECOMMENDATION

**System health score: 6.5 → ~7.5 / 10** (in progress). Since the audit: **Phase 0 is
complete** (auth throttling, real session encryption, deploy-migration race removed,
slim image, CI Docker build), tenant isolation is now **enforced by an integration
suite** (41 tests) rather than convention, three real **visibility leaks** were found
and fixed, and **every session-authenticated API route** is migrated onto the `withApi`
+ tenant-scoping foundation (Phase 1 rollout, T1.3, complete). Remaining gaps keep it
from a clean 8-9: no service layer yet (T1.1), no E2E, tests run on SQLite (no
Postgres CI matrix), the in-memory analytics scan, and logs-only observability.

**Biggest risks now (in order):**
1. **Tests run on SQLite, not Postgres** - provider-specific bugs can still escape CI (the tenancy *logic* is, however, now covered).
2. **No E2E coverage** of the money path (Stripe checkout/webhook) or the golden user journeys.
3. **Scale/observability** - unbounded analytics scan + no metrics/tracing for MTTR.

**Most important next step:** with the **Phase 1 `withApi` rollout now complete**, add the
**Postgres CI matrix + Stripe-webhook test** (T3.3/T3.1) so the now-substantial test suite
(41 integration tests) runs against the real engine and the billing path, then extract the
first **service-layer domain** (T1.1) on top of the `withApi`/tenant foundation. After
that, Phase 2 (analytics SQL + caching/retention).
