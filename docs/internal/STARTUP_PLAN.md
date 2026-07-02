# DecisionOS - Startup Improvement Plan

> A precise, real-world roadmap for turning DecisionOS from a feature-complete
> codebase into a fundable, sellable product. Grounded in the actual state of
> the repo as of this writing - not generic SaaS advice.

---

## 1. Honest baseline: what already exists

DecisionOS is **not an MVP** - it is a substantially complete multi-tenant B2B
SaaS. What's already built and working:

- **Decision records** with full lifecycle (draft → review → approved →
  superseded/deprecated/reversed/archived), RACI fields, version history, audit
  log, notes/replies, reactions, tags, resource links.
- **Decision graph** - interactive force-directed canvas of relationships
  (supersedes, depends_on, relates_to, conflicts_with).
- **Ask DecisionOS** - grounded, cited natural-language Q&A over the decision
  log (degrades to semantic search when no AI key is configured).
- **Review loops** - outcome tracking, overdue/upcoming review hub, magic-link
  email reviews (no login required).
- **Integrations**: Slack (full OAuth install + slash command + emoji capture +
  DM reminders), Stripe billing (checkout → webhook), OIDC SSO (full discovery +
  JWKS verification, Enterprise-gated), SMTP email.
- **Platform**: Next.js 16 / React 19 / Prisma v7 / Tailwind v4, custom JWE
  sessions, three-layer tenant isolation, rate limiting (in-memory + Redis),
  structured logging, first-party analytics, CI (type-check, lint, smoke +
  integration tests, build, Docker), IaC for GCP and AWS ECS.

**Engineering quality is genuinely high**: zero `TODO`/`FIXME` markers, a
centralized `withApi` authz wrapper, and well-tested multi-tenancy.

**Conclusion:** the gap to a startup is *not* "build more features." It is a
sharper wedge, proof of usage, and closing a handful of reliability holes that
bite at paying-customer scale.

---

## 2. The strategic problem to solve

"Decision tracking" is a known graveyard - ADRs, Notion docs, and Confluence
pages all decay because **capture is friction and nobody returns to read them.**

DecisionOS's differentiation already exists in the code; the job is to make it
the *whole* product story rather than one feature among fifteen:

1. **Capture where work happens** - Slack emoji → logged decision. Beats every
   doc-based competitor on the only metric that matters: friction at capture.
2. **Grounded retrieval** - turns a write-only archive into queryable
   institutional memory ("why did we decide X?").
3. **Review loops** - decisions get revisited against real outcomes, so the data
   compounds and the org measurably improves at deciding.

**Sharpened pitch:**
> *Institutional memory that captures itself in Slack and answers "why did we
> decide this?" months later.*

---

## 3. Prioritized improvements

### P0 - Reliability gaps that hurt with real customers

| Item | Status | Notes |
|---|---|---|
| `CRON_SECRET` optional in prod → unauthenticated cron fan-out | **Fixed** | Was: unset secret silently *opened* `/api/cron/*` in production. Now locks the endpoint; centralized in `src/lib/env.ts` (`isAuthorizedCron`) with smoke coverage. |
| No error tracking (production bugs are silent) | **Fixed** | Sentry wired through `logger.error` (the single point `withApi` and all routes funnel errors through), in `src/lib/error-reporting.ts`. Optional (`SENTRY_DSN`-gated, dynamic import) so it degrades to logs when unconfigured. A tested PII/secret scrubber (`scrub()`) redacts credentials/PII before anything leaves the process. |
| Untested money/integration paths | **In progress** | Added: Stripe webhook signature verification extracted to a tested pure `verifyStripeSignature` + smoke suite (tamper/replay/rotation); integration tests for the Stripe webhook route (plan transitions + every rejection path) and the Slack slash-command route (signature gate + install/link/modal flows). Remaining: Slack OAuth install/events, cron email flows. |
| Billing is workspace-wide, not per-seat | Open | Stripe checkout uses per-user quantity, but the webhook flips a single workspace flag; seats aren't reconciled on `subscription.updated`. Real teams add/remove people → under/over-billing. |

### P1 - Product moves that make it sticky and demo-able

- **Make "Ask" the front door**, not a side route. The first cited answer to
  "why did we kill the Postgres migration?" is the aha moment. Surface it on the
  dashboard and in Slack (`/decisionos ask`).
- **Activate the review nudge.** Decision health is computed but passive. Push a
  weekly Slack digest of "due for review" and "replaced but never retro'd" - the
  review loop is the retention engine.
- **Promote templates + RACI** (already in the schema) into guided "decision
  frameworks" (ADR, RFC, vendor selection) - an easy onboarding and
  content-marketing hook.

### P2 - Observability & scale proof (for diligence)

- No APM, no query metrics, no load test. Establish a baseline (the unused
  `/api/health` endpoint is a starting point) and a simple dashboard.
- No staging environment / post-deploy smoke / rollback. Add a staging target
  and a post-deploy health check.

### P3 - Go-to-market & monetization

- **Pricing reality check.** $5/user/mo unlimited is likely underpriced and
  over-reliant on seats for a tool not everyone opens daily. Consider
  workspace-based tiers or value metrics (decisions tracked, AI questions). The
  Free tier (200 decisions / 7 members) is a reasonable funnel.
- **Meter AI usage.** Hosted "Ask" is COGS; meter it per plan.
- **Distribution.** A Slack App Directory listing is the single
  highest-leverage GTM move - the capture flow is already built; that's the
  channel.
- **Wedge customer.** Eng/product orgs at 20-200 person companies drowning in
  Slack decisions. Land via the Slack bot, expand via Ask + reviews.

---

## 4. Suggested 90-day sequence

| Phase | Focus | Outcome |
|---|---|---|
| Weeks 1-3 | P0 reliability: cron auth (done), Sentry, seat-sync, test money/Slack paths | No silent revenue/capture breakage |
| Weeks 4-7 | Elevate Ask + automate review nudges; Slack App Directory submission | A demo that produces the aha + a real acquisition channel |
| Weeks 8-12 | Pricing/metering rework, observability baseline, staging | Diligence-ready + sustainable unit economics |

---

## 5. One-paragraph pitch this supports

> DecisionOS is institutional memory for fast-moving teams. Decisions get
> captured the moment they happen - react with an emoji in Slack - and months
> later anyone can ask "why did we decide this?" and get a cited answer.
> Built-in review loops mean decisions are revisited against their actual
> outcomes, so the org gets measurably better at deciding. Multi-tenant,
> SSO-ready, and live.
