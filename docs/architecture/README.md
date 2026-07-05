# DecisionOS Architecture

How the codebase is organized **by layer**, and how a request flows through them.
Each layer has its own deep-dive:

| Layer | Doc | Lives in |
|---|---|---|
| Frontend (pages + components) | [frontend-layer.md](frontend-layer.md) | `src/app/(app)`, `src/components` |
| API (route handlers) | [api-layer.md](api-layer.md) | `src/app/api` |
| Business logic & infrastructure | [business-logic-layer.md](business-logic-layer.md) | `src/lib`, `src/actions` |
| Data (Prisma + DB) | [data-layer.md](data-layer.md) | `src/lib/prisma.ts`, `prisma/` |

For deployment/infra architecture (AWS ECS), see [`deploy/aws-ecs/docs/`](https://github.com/shafaypro/DecisionOS/blob/main/deploy/aws-ecs/docs/ARCHITECTURE.md).

---

## The layered model

```mermaid
flowchart TB
  subgraph fe["FRONTEND · src/app/(app)/**/page.tsx + src/components/**"]
    rsc["React Server Components<br/>render data"]
    cc["Client components<br/>handle input"]
  end

  subgraph api["API LAYER · src/app/api/**/route.ts"]
    handlers["REST handlers - ALL mutations<br/>session + role check → validate → scope"]
  end

  subgraph lib["BUSINESS LOGIC & INFRA · src/lib/**"]
    pure["Pure logic<br/>health · similarity · graph"]
    infra["Infrastructure<br/>session · crypto · env · rate-limit · logger"]
    integ["Integrations<br/>slack · sso · email · anthropic"]
  end

  subgraph data["DATA LAYER · src/lib/prisma.ts + prisma/"]
    prisma["Prisma v7 client + driver adapter<br/>PostgreSQL (prod) / SQLite (dev)"]
  end

  rsc -->|"reads · getSession + prisma"| lib
  cc -->|"writes · fetch()"| handlers
  handlers --> lib
  lib --> prisma

  classDef feStyle fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;
  classDef apiStyle fill:#fef3c7,stroke:#d97706,color:#78350f;
  classDef libStyle fill:#dcfce7,stroke:#16a34a,color:#14532d;
  classDef dataStyle fill:#f3e8ff,stroke:#9333ea,color:#581c87;
  class rsc,cc feStyle;
  class handlers apiStyle;
  class pure,infra,integ libStyle;
  class prisma dataStyle;
```

**The golden rule (enforced by a real Turbopack bug):** state-changing work goes
through the **API layer**, never server actions inside `src/app/(app)/`. The only
server actions are auth (`src/actions/auth.ts`), which live outside the app layout.
See [CONTRIBUTING.md → Architecture constraints](https://github.com/shafaypro/DecisionOS/blob/main/CONTRIBUTING.md#4-architecture-constraints).

---

## End-to-end request flows

### A. Loading a protected page (read path)

```mermaid
sequenceDiagram
  autonumber
  actor B as Browser
  participant P as src/proxy.ts<br/>(auth guard)
  participant R as decisions/page.tsx<br/>(Server Component)
  participant DB as Prisma

  B->>P: GET /decisions
  alt no valid session
    P-->>B: redirect /login
  else session ok
    P->>R: continue
    R->>R: getSession() → { userId, workspaceId, role }
    R->>DB: decision.findMany({ where: { workspaceId } })
    DB-->>R: rows
    R-->>B: HTML streamed (no client JS needed for the data)
  end
```

The guard is `src/proxy.ts` - the Next.js 16 convention, **not** `middleware.ts`.

### B. Creating / changing data (write path)

```mermaid
sequenceDiagram
  autonumber
  participant C as Client component<br/>(decision-form.tsx)
  participant H as api/decisions/route.ts<br/>(withApi)
  participant DB as Prisma

  C->>H: fetch POST /api/decisions { body }
  Note over H: 1 getSession() → 401 if missing<br/>2 role check (viewer/admin) → 403<br/>3 revalidate live membership → 401/403<br/>4 Zod-validate the body → 400<br/>5 workspace-scope the resource → 404
  H->>DB: $transaction([ write + audit event ])
  DB-->>H: committed atomically
  H--)H: track() analytics (fire-and-forget)
  H-->>C: JSON response
  C->>C: router.refresh()
```

### C. Inbound webhook / integration (no user session)

```mermaid
sequenceDiagram
  autonumber
  participant S as Slack
  participant W as api/slack/*<br/>route handlers
  participant DB as Prisma

  S->>W: POST (slash command / event)
  W->>W: verify HMAC + timestamp replay window (lib/slack/verify)
  W->>W: decrypt stored bot secret (lib/crypto · AES-256-GCM)
  W->>DB: writes
  W-->>S: 200 quickly (Slack's 3s deadline)
  W--)W: outbound calls are fire-and-forget
```

### D. Scheduled job

```mermaid
sequenceDiagram
  autonumber
  participant Cr as Scheduler<br/>(Vercel cron / EventBridge)
  participant J as /api/cron/*<br/>review-reminders · weekly-digest
  participant DB as Prisma

  Cr->>J: GET/POST · Authorization: Bearer CRON_SECRET
  alt bad or missing secret
    J-->>Cr: 401 (fails closed in production)
  else authorized
    J->>DB: query due decisions
    J--)J: send email / Slack DMs
    J->>DB: write NotificationLog
    J-->>Cr: 200 + summary
  end
```

On Vercel: `vercel.json` crons. On ECS: EventBridge (`deploy/aws-ecs/optional-scheduled-jobs.tf`).

---

## Cross-cutting concerns

| Concern | Where | Notes |
|---|---|---|
| **Auth guard** | `src/proxy.ts` | Next 16 convention; gates protected routes, allows `/login`, `/signup`, `/`, `/pricing`, `/share`. |
| **Sessions** | `src/lib/session.ts` | Encrypted JWE (jose, `dir` + A256GCM) in an httpOnly cookie; 7-day expiry. API routes also revalidate live membership + workspace status per request (`src/lib/access-control.ts`). |
| **Authorization** | `src/lib/auth-guards.ts` | `isViewer` / `canWrite` / `isAdmin` helpers used per route. |
| **Platform authorization** | `src/lib/platform-authorize.ts`, `src/lib/platform-api-handler.ts` | Provider control plane - a **separate axis** from the workspace role. `isPlatformAdmin` / `authorizePlatform` / `withPlatformApi` gate the `(platform)/admin` console + `/api/platform/*` (staff from `PLATFORM_ADMIN_EMAILS`). Does **not** touch `workspaceWhere()` - tenant isolation is unchanged. See [PLATFORM_ADMIN.md](../PLATFORM_ADMIN.md). |
| **Config & secrets** | `src/lib/env.ts` | Single validated source; `SESSION_SECRET`/`DATABASE_URL` required in prod. |
| **Encryption at rest** | `src/lib/crypto.ts` | AES-256-GCM for stored Slack/SSO secrets; per-record salt. |
| **Rate limiting** | `src/lib/rate-limit.ts` | Redis-backed (multi-instance) with in-memory fallback. |
| **Logging** | `src/lib/logger.ts` | Structured JSON in prod for cloud log aggregation. |
| **Analytics** | `src/lib/analytics.ts` | First-party events to the DB; fire-and-forget. |
| **Workspace isolation** | every API route | Resources are filtered by `session.workspaceId`; cross-workspace access → 404. Platform-admin "enter company" works *within* this rule by swapping `session.workspaceId`, not by bypassing the filter. |

## Authentication flow

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant L as /login<br/>(server action)
  participant S as lib/session.ts
  participant P as src/proxy.ts
  participant A as API routes<br/>(withApi)

  U->>L: POST credentials
  L->>L: bcrypt.compare(password, passwordHash)
  L->>S: createSession({ userId, workspaceId, role, email, name })
  S-->>U: Set-Cookie session=JWE (A256GCM) · HttpOnly · SameSite=Lax

  Note over U,P: every page request
  U->>P: GET /any-page
  P->>P: decrypt cookie
  alt no valid session
    P-->>U: redirect /login
  else session + public route
    P-->>U: redirect /dashboard
  end

  Note over U,A: every API request
  U->>A: fetch /api/*
  A->>A: getSession() → payload
  A->>A: role check → revalidate live membership + workspace status (30s cache)
  A->>A: scope every query by session.workspaceId
```

Session payload shape:

```ts
{
  userId: string
  workspaceId: string
  role: "admin" | "member" | "viewer"
  email: string
  name: string
  // Platform control plane - present only for provider staff (see PLATFORM_ADMIN.md)
  platformRole?: "superadmin"      // sourced from PLATFORM_ADMIN_EMAILS at login; never DB-granted
  platformHomeWorkspaceId?: string // the admin's own workspace - the way back from impersonation
}
```

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind v4 ·
Prisma v7 (driver adapters) · PostgreSQL (prod) · jose (JWT) · bcryptjs · Radix UI.
