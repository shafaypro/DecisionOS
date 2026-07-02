# DecisionOS Architecture

How the codebase is organized **by layer**, and how a request flows through them.
Each layer has its own deep-dive:

| Layer | Doc | Lives in |
|---|---|---|
| Frontend (pages + components) | [frontend-layer.md](frontend-layer.md) | `src/app/(app)`, `src/components` |
| API (route handlers) | [api-layer.md](api-layer.md) | `src/app/api` |
| Business logic & infrastructure | [business-logic-layer.md](business-logic-layer.md) | `src/lib`, `src/actions` |
| Data (Prisma + DB) | [data-layer.md](data-layer.md) | `src/lib/prisma.ts`, `prisma/` |

For deployment/infra architecture (AWS ECS), see [`deploy/aws-ecs/docs/`](../../deploy/aws-ecs/docs/ARCHITECTURE.md).

---

## The layered model

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND   src/app/(app)/**/page.tsx  +  src/components/**            │
│ React Server Components render data; client components handle input.  │
└───────────────┬───────────────────────────────────┬──────────────────┘
        reads   │ (RSC call getSession + prisma)     │ writes (fetch)
                │                                     ▼
                │                    ┌─────────────────────────────────┐
                │                    │ API LAYER   src/app/api/**/route │
                │                    │ REST handlers - ALL mutations.   │
                │                    │ session + role check → validate  │
                │                    └───────────────┬─────────────────┘
                ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BUSINESS LOGIC & INFRA   src/lib/**                                   │
│ pure logic (health, similarity, plans, graph) · session/crypto/env    │
│ · rate-limit · logger · integrations (slack, sso, stripe, email)      │
└───────────────────────────────────┬───────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ DATA LAYER   src/lib/prisma.ts + prisma/                              │
│ Prisma v7 client + driver adapter → PostgreSQL (prod) / SQLite (note) │
└─────────────────────────────────────────────────────────────────────┘
```

**The golden rule (enforced by a real Turbopack bug):** state-changing work goes
through the **API layer**, never server actions inside `src/app/(app)/`. The only
server actions are auth (`src/actions/auth.ts`), which live outside the app layout.
See [CONTRIBUTING.md → Architecture constraints](../../CONTRIBUTING.md#4-architecture-constraints).

---

## End-to-end request flows

### A. Loading a protected page (read path)

```
Browser GET /decisions
   │
   ▼
src/proxy.ts  ──(no session)──▶ redirect /login
   │ (Next.js 16 auth guard - NOT middleware.ts)
   ▼ session ok
src/app/(app)/decisions/page.tsx   ← React Server Component
   │  getSession()  → SessionPayload (userId, workspaceId, role)
   │  prisma.decision.findMany({ where: { workspaceId } })
   ▼
HTML streamed to the browser (no client JS needed for the data)
```

### B. Creating / changing data (write path)

```
Client component (e.g. decision-form.tsx)
   │  fetch("/api/decisions", { method: "POST", body })
   ▼
src/app/api/decisions/route.ts
   │  1. getSession()                      → 401 if missing
   │  2. auth-guards: isViewer/isAdmin     → 403 if not allowed
   │  3. validate + normalize the body
   │  4. workspace-scope the resource      → 404 if cross-workspace
   │  5. prisma.$transaction([...])        → write + audit event atomically
   │  6. track(...) analytics (fire-and-forget)
   ▼
JSON response → client refreshes / router.refresh()
```

### C. Inbound webhook / integration (no user session)

```
Slack / Stripe  ──POST──▶  src/app/api/{slack,billing}/...
   │  verify HMAC signature + timestamp (replay window)   ← lib/slack/verify, billing/webhook
   │  decrypt stored bot/secret (lib/crypto)              ← AES-256-GCM
   │  prisma writes + best-effort outbound calls
   ▼
200 quickly (Slack's 3s deadline) - outbound work is fire-and-forget
```

### D. Scheduled job

```
Scheduler ──GET/POST──▶ /api/cron/{review-reminders,weekly-digest}
   │  Authorization: Bearer <CRON_SECRET>     ← rejected otherwise
   │  query due decisions → send email/Slack → write NotificationLog
   ▼
On Vercel: vercel.json crons. On ECS: EventBridge (deploy/aws-ecs/optional-scheduled-jobs.tf).
```

---

## Cross-cutting concerns

| Concern | Where | Notes |
|---|---|---|
| **Auth guard** | `src/proxy.ts` | Next 16 convention; gates protected routes, allows `/login`, `/signup`, `/`, `/pricing`, `/share`. |
| **Sessions** | `src/lib/session.ts` | JWT (jose, HS256) in an httpOnly cookie; 7-day expiry. |
| **Authorization** | `src/lib/auth-guards.ts` | `isViewer` / `canWrite` / `isAdmin` helpers used per route. |
| **Platform authorization** | `src/lib/platform-authorize.ts`, `src/lib/platform-api-handler.ts` | Provider control plane - a **separate axis** from the workspace role. `isPlatformAdmin` / `authorizePlatform` / `withPlatformApi` gate the `(platform)/admin` console + `/api/platform/*` (staff from `PLATFORM_ADMIN_EMAILS`). Does **not** touch `workspaceWhere()` - tenant isolation is unchanged. See [PLATFORM_ADMIN.md](../PLATFORM_ADMIN.md). |
| **Config & secrets** | `src/lib/env.ts` | Single validated source; `SESSION_SECRET`/`DATABASE_URL` required in prod. |
| **Encryption at rest** | `src/lib/crypto.ts` | AES-256-GCM for stored Slack/SSO secrets; per-record salt. |
| **Rate limiting** | `src/lib/rate-limit.ts` | Redis-backed (multi-instance) with in-memory fallback. |
| **Logging** | `src/lib/logger.ts` | Structured JSON in prod for cloud log aggregation. |
| **Analytics** | `src/lib/analytics.ts` | First-party events to the DB; fire-and-forget. |
| **Workspace isolation** | every API route | Resources are filtered by `session.workspaceId`; cross-workspace access → 404. Platform-admin "enter company" works *within* this rule by swapping `session.workspaceId`, not by bypassing the filter. |

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind v4 ·
Prisma v7 (driver adapters) · PostgreSQL (prod) · jose (JWT) · bcryptjs · Radix UI.
