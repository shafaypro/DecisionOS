# DecisionOS Roadmap & Improvement Proposals

> Last updated: 2026-06-24

This document consolidates the production-readiness audit
(`docs/internal/PRODUCTION_READINESS.md`) and proposes improvements across infrastructure,
testing, and developer experience.

---

## Current State

| Area | Health | Notes |
|------|--------|-------|
| Core features | **Strong** | Decision CRUD, versioning, relations, templates, search, AI draft |
| Auth & security | **Strong** | JWE sessions, bcrypt, rate-limiting, CSP, HSTS |
| Multi-tenancy | **Good** | Application-enforced workspace isolation, integration tests |
| Integrations | **Good** | Slack bot, Stripe billing, OIDC SSO, SMTP email |
| Testing | **Moderate** | 13 smoke suites + 41 integration tests; no E2E, no Postgres CI |
| Observability | **Weak** | Console logging only; no metrics, tracing, or error tracking |
| Infrastructure | **Moderate** | Docker + GCP free-tier + AWS ECS; missing EC2, K8s, self-hosted patterns |
| CI/CD | **Moderate** | CI builds/tests/lints; no CD pipeline, no auto-deploy |

---

## Phase 0 - Stabilization (COMPLETED)

- [x] Login rate-limiting (token bucket)
- [x] Session encryption (JWE/A256GCM)
- [x] Slim Docker runner image (production deps only)
- [x] Migrator image separation (one-shot per deploy)
- [x] Security headers (CSP, HSTS, X-Frame-Options)

## Phase 1 - Architecture (IN PROGRESS)

- [x] Tenant-scoping helper (`withApi` wrapper)
- [x] Integration tests for tenancy isolation (41 tests)
- [x] Delete legacy server actions from `(app)` layout
- [ ] **T1.1** Extract service/domain layer from route handlers
- [ ] **T1.2** Move JSON-denormalized fields (consultedIds) to proper relations

## Phase 2 - Core Improvements (TODO)

- [ ] **T2.1** Analytics SQL aggregates (replace in-memory scan)
- [ ] **T2.2** Caching / revalidation strategy for decision lists
- [ ] **T2.3** Retention TTL for append-only tables (AnalyticsEvent, NotificationLog, DecisionEvent)
- [ ] **T2.4** Pagination for decision version history and audit log

## Phase 3 - Testing (IN PROGRESS)

- [x] Vitest integration tests (41 tests)
- [ ] **T3.1** Stripe-webhook HMAC smoke test
- [ ] **T3.2** Playwright E2E for golden paths (auth, decision CRUD, billing checkout)
- [ ] **T3.3** Postgres CI matrix (run integration tests on Postgres, not just SQLite)
- [ ] **T3.4** Coverage thresholds (enforce minimum line/branch coverage)

## Phase 4 - Observability (TODO)

- [ ] **T4.1** Structured JSON logging (replace console.log)
- [ ] **T4.2** OpenTelemetry traces + Sentry error tracking
- [ ] **T4.3** Prometheus metrics endpoint (`/api/metrics`)
- [ ] **T4.4** Health check expansion (DB connectivity, Redis ping, uptime)
- [ ] **T4.5** Alerting runbook (PagerDuty / OpsGenie integration patterns)

## Phase 5 - Developer Experience (TODO)

- [ ] **T5.1** Pre-commit hooks (lint-staged + husky)
- [ ] **T5.2** Postgres-backed local dev parity (docker compose with app service)
- [ ] **T5.3** Dev seed improvements (more realistic data, configurable volume)
- [ ] **T5.4** Storybook completion for all UI primitives

## Phase 6 - AI & Model Extensibility (TODO)

- [ ] **T6.1** Generalized provider registry (OpenAI, Gemini, local models)
- [ ] **T6.2** Custom company-model connector (corporate proxy endpoints)
- [ ] **T6.3** Bring-your-own-model support per workspace
- [ ] **T6.4** AI-powered decision templates (auto-suggest fields from context)

---

## NEW: Infrastructure & Deployment Improvements

### What exists today

| Target | Path | Status |
|--------|------|--------|
| Docker (multi-stage) | `Dockerfile` | Production-ready |
| Docker Compose (dev) | `docker-compose.yml` | Dev only (Postgres + Redis) |
| GCP free-tier | `deploy/gcp/free-tier/` | e2-micro + SQLite + Caddy |
| AWS ECS Fargate | `deploy/aws-ecs/` | ALB + Fargate + RDS + ElastiCache |
| Vercel | `vercel.json` | Cron config only |
| GitHub Actions CI | `.github/workflows/ci.yml` | Build + test + Docker |

### What we're adding

| Target | Path | Use case |
|--------|------|----------|
| Docker Compose (prod) | `deploy/docker-compose/` | Self-hosted, single-server, Postgres + Redis + Caddy |
| AWS EC2 | `deploy/aws-ec2/` | Single EC2 instance, cheaper than ECS for small teams |
| Kubernetes | `deploy/kubernetes/` | EKS / GKE / AKS / any conformant cluster |
| Deployment guide | `docs/deployment/README.md` | Comparison matrix + decision tree |

### Proposed CI/CD improvements

1. **CD pipeline** - Auto-deploy to staging on merge to `main`; manual promotion to production
2. **Docker image tagging** - Semantic versioning + git SHA tags (not just `:latest`)
3. **Multi-arch builds** - ARM64 support for Graviton (ECS) and ARM-based K8s nodes
4. **Terraform state** - Remote state backend (S3 + DynamoDB / GCS) for team collaboration
5. **Secret rotation** - Automated `SESSION_SECRET` rotation with grace period for active sessions
6. **Blue/green deploys** - ALB target group switching for zero-downtime on ECS
7. **Database backup automation** - Scheduled pg_dump with S3/GCS upload and retention policy

### Deployment decision tree

```
Q: How many users?
├─ < 50 users, minimal budget
│  ├─ AWS? → deploy/aws-ec2/ (single t3.micro, ~$8/mo)
│  ├─ GCP? → deploy/gcp/free-tier/ (e2-micro, free tier eligible)
│  └─ Own server? → deploy/docker-compose/ (self-hosted)
│
├─ 50-500 users, need reliability
│  ├─ AWS? → deploy/aws-ecs/ (Fargate, managed scaling)
│  ├─ K8s cluster? → deploy/kubernetes/ (Helm chart)
│  └─ Vercel? → vercel.json + external Postgres
│
└─ 500+ users, enterprise
   ├─ AWS? → deploy/aws-ecs/ with multi-AZ RDS + ElastiCache cluster
   └─ K8s? → deploy/kubernetes/ with HPA + PDB + Ingress
```

---

## Product roadmap summary

**Current stance: NARROW** - focus on the core decision-capture loop.

| Timeframe | Focus | Key deliverables |
|-----------|-------|------------------|
| Weeks 1-4 | Narrow surface | Strip non-essential features, polish core CRUD, mobile-friendly |
| Weeks 5-8 | Slack bot + charge | Slack capture bot MVP, Stripe billing live, Team plan launch |
| Weeks 9-12 | Retention + enterprise | Review reminders, weekly digest, SSO, enterprise plan |
| Post-90 days | Scale | AI improvements, API access, audit log export, custom integrations |

**One metric that matters:** >= 2 decisions/month + >= 4 app opens/month = retained user.
