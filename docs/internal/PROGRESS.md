# DecisionOS - Hardening & Startup-Readiness Progress

A living checklist of work done and work remaining, tracking the roadmap in
[`STARTUP_PLAN.md`](./STARTUP_PLAN.md). Updated as PRs land.

Legend: ✅ done & merged · 🟡 in progress · ⬜ not started

---

## P0 - Reliability & security (must-have before paying customers)

- ✅ **Require `CRON_SECRET` in production** - cron fan-out endpoints fail closed when misconfigured. *(PR #31)*
- ✅ **Error tracking (Sentry)** - wired through `logger.error`; optional, DSN-gated; PII/secret scrubber. *(PR #31)*
- ✅ **Stripe webhook hardened + tested** - pure `verifyStripeSignature`, multi-`v1` rotation, 400 on malformed body. *(PR #31)*
- ✅ **Money/integration path tests** - Stripe webhook + Slack command integration tests. *(PR #31)*
- ✅ **Security scanning in CI** - gitleaks (secret scan), CodeQL (SAST), dependency review, npm audit. *(PR #32)*
- ✅ **Per-seat billing reconciliation** - member add/remove syncs the Stripe subscription quantity. *(this PR)*
  - ✅ `Workspace.seats` / `seatsSyncedAt` schema fields + Postgres migration
  - ✅ `updateSubscriptionQuantity()` Stripe helper
  - ✅ Pure `computeSeatChange()` + `reconcileSeats()` (best-effort, never breaks the mutation)
  - ✅ Wired into team invite, **new member-removal endpoint**, and SSO provisioning
  - ✅ Webhook reflects portal-side quantity changes back into our record
  - ✅ Smoke tests (decision logic) + integration tests (removal + reconciliation)

## P1 - Stickiness & activation

- ⬜ **Elevate "Ask DecisionOS"** to a front-door experience (dashboard + Slack `/decisionos ask`)
- ⬜ **Automate review nudges** - weekly Slack digest of due / replaced-but-not-retro'd decisions
- ⬜ **Decision frameworks** - promote templates + RACI into guided flows (ADR, RFC, vendor selection)

## P2 - Observability & scale proof

- 🟡 **Error tracking** live (Sentry) - needs `SENTRY_DSN` set in production
- ⬜ **APM / query metrics + a dashboard**; wire the unused `/api/health` endpoint
- ⬜ **Staging environment + post-deploy smoke + rollback**

## P3 - Go-to-market & monetization

- ⬜ **Pricing/metering rework** - consider workspace tiers or value metrics; meter hosted "Ask" AI usage
- ⬜ **Slack App Directory listing** - highest-leverage distribution given the capture flow
- ⬜ **Free-tier member limit on SSO auto-provision** - SSO can currently exceed the 7-member free cap

## Infra follow-ups

- ⬜ **Enable GitHub Advanced Security**, then remove the `continue-on-error` from CodeQL + dependency-review so they hard-gate *(see SECURITY.md)*

---

## Notes for contributors

- Local `tsc`/integration tests can't run where Prisma's engine download is
  blocked by egress; CI generates the client and runs the full suite. Pure
  logic (e.g. `computeSeatChange`, `verifyStripeSignature`) is covered by the
  zero-dependency smoke suite, which runs anywhere.
