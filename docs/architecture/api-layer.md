# API Layer - `src/app/api/`

REST route handlers. **Every state-changing operation in the app lives here** (not in
server actions - see the constraint in [README](README.md#the-layered-model)). ~43 route
files, grouped by resource.

## Request lifecycle

```
fetch("/api/<resource>", { method, body })
        │
        ▼  (the proxy.ts guard has already run for page navigations; API routes
        │   re-check the session themselves since they're hit directly too)
┌────────────────────────────────────────────────────────────┐
│ route handler  (GET/POST/PATCH/DELETE)                     │
│                                                            │
│  1. AUTHN   const session = await getSession()             │  → 401 if null
│  2. AUTHZ   isViewer(session.role) / isAdmin(...)          │  → 403 if not allowed
│  3. PARSE   const body = await req.json(); normalize/trim  │  → 400 on bad input
│  4. SCOPE   load resource, assert workspaceId matches      │  → 404 if cross-workspace
│  5. WRITE   prisma.$transaction([... + audit event])      │
│  6. SIDE    track(...) analytics, fire-and-forget          │
│  7. RETURN  NextResponse.json({...}, { status })          │
└────────────────────────────────────────────────────────────┘
```

Steps 1-4 are the same opening lines in almost every handler - see
[reuse opportunity](#known-rough-edges-improvement-backlog) below.

## The standard handler shape

```ts
// src/app/api/decisions/reviews/route.ts (representative)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isViewer(session.role)) return NextResponse.json(VIEWER_ERROR, { status: 403 });

  const { decisionId, outcomeStatus, ... } = await req.json();
  if (!decisionId) return NextResponse.json({ error: "decisionId required." }, { status: 400 });

  const decision = await prisma.decision.findUnique({ where: { id: decisionId } });
  if (!decision || decision.workspaceId !== session.workspaceId)
    return NextResponse.json({ error: "Decision not found." }, { status: 404 });

  await prisma.$transaction([
    prisma.decisionReview.create({ ... }),
    prisma.decision.update({ ... }),
    prisma.decisionEvent.create({ ... }),   // audit trail
  ]);
  return NextResponse.json({ success: true });
}
```

## Route groups

| Group | Routes | Purpose |
|---|---|---|
| `decisions/` | CRUD, `[id]`, `versions`, `relations`, `reactions`, `supersede`, `archive`, `reviews`, `notes`, `links`, `tags`, `bulk`, `search`, `similar`, `export`, `ai-draft` | The core domain. |
| `action-items/` | list/create, `[id]` | Kanban tasks tied to decisions. |
| `team/`, `settings/`, `settings/sso/`, `tags/`, `templates/` | workspace admin | Membership, config, SSO, tags, templates. |
| `integrations/` | get/put/delete | Slack/Teams/email/Anthropic config (encrypted). |
| `slack/` | `install`, `oauth/callback`, `events`, `actions`, `commands/log`, `connect-user` | Slack capture bot. |
| `auth/sso/[slug]/` | `start`, `callback` | OIDC SSO flow. |
| `notifications/` | list, `send` | In-app + outbound notifications. |
| `cron/` | `review-reminders`, `weekly-digest`, `audit-retention` | Scheduled jobs (bearer-auth). |
| `platform/` | `workspaces`, `workspaces/[id]`, `workspaces/[id]/enter`, `exit` | Provider control plane - **staff-only**, cross-tenant. See below. |
| `health`, `seed` | ops | Liveness probe; dev-only demo seed. |

## Conventions

- **Auth:** `getSession()` ([session.ts](business-logic-layer.md)) then
  `isViewer`/`canWrite`/`isAdmin` from `src/lib/auth-guards.ts`. Reads usually need only a
  session; writes additionally reject viewers; admin-only routes (team, integrations,
  settings) check `isAdmin`.
- **Workspace isolation:** every resource is re-loaded and checked against
  `session.workspaceId`. A valid session from another workspace gets a 404, never data.
- **Platform routes (`platform/*`):** the one deliberate exception to workspace scoping. They use
  `withPlatformApi` (not `withApi`) - a parallel wrapper that requires `session.platformRole` and
  is intentionally cross-tenant. This is the provider control plane; see
  [PLATFORM_ADMIN.md](../PLATFORM_ADMIN.md). Tenant isolation for ordinary routes is unaffected.
- **Validation:** hand-rolled (`.trim()`, length/format checks) - no schema library yet.
- **Errors:** `NextResponse.json({ error }, { status })`. Multi-write routes wrap a
  `try/catch` to translate Prisma unique-constraint errors into friendly 400s.
- **Transactions:** create + audit-event pairs run inside `prisma.$transaction([...])` so a
  partial failure can't orphan rows.
- **Webhooks** (`slack/*`) have **no user session** - they authenticate
  by HMAC signature + timestamp replay window instead, then decrypt stored secrets.
- **Rate limiting:** applied on abuse-prone public/expensive routes (`search`, `similar`,
  `auth/sso/start`, public `share`) via `src/lib/rate-limit.ts`.

## Known rough edges (improvement backlog)

- Steps 1-4 are duplicated ~40×; a `requireSession(role?)` /
  `requireWorkspaceResource()` helper would collapse them (tracked as a follow-up).
- No shared validation schema (Zod) yet - validation lives inline per route.
- Response envelopes vary (`{ success: true }` vs `{ items }` vs `{ decisions }`).

See [business-logic-layer.md](business-logic-layer.md) for the helpers these handlers call,
and [data-layer.md](data-layer.md) for the Prisma/transaction details.
