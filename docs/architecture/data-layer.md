# Data Layer - `src/lib/prisma.ts` + `prisma/`

Prisma v7 with **driver adapters**. The client is generated into `src/generated/prisma`
(not `@prisma/client`) and instantiated as a singleton.

## Client construction & adapter selection

```
            getDatabaseUrl()  (src/lib/env.ts)
                    │
                    ▼
   src/lib/prisma.ts  createPrismaClient()
                    │
       ┌────────────┴─────────────┐
   postgres:// or                 file:  /  libsql://
   postgresql://                       │
       │                               │
       ▼                               ▼
   pg Pool (max=DATABASE_POOL_MAX)   PrismaLibSql adapter
   + PrismaPg adapter
       │                               │
       └──────────► new PrismaClient({ adapter }) ◄──────┘
                    │
   singleton on globalThis (one client per process; reused on dev hot-reload)
```

```ts
// shape of src/lib/prisma.ts
const url = getDatabaseUrl();
if (url.startsWith("postgres")) { /* pg Pool + PrismaPg */ }
else                            { /* PrismaLibSql (file:/libsql:) */ }
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
```

## ⚠️ Prisma v7 is provider-locked - important

The **generated client is tied to the schema's `provider`**. The schema is now
`provider = "postgresql"`, so at runtime Prisma **rejects a SQLite/libsql adapter**:

```
The Driver Adapter `@prisma/adapter-libsql`, based on `sqlite`,
is not compatible with the provider `postgres` specified in the Prisma schema.
```

Consequences (and how the repo handles it):
- The `file:`/libsql branch in `prisma.ts` only works when the client was generated against a
  **`sqlite`** schema. The committed schema is Postgres, so the client must be regenerated for
  SQLite to use `dev.db` locally - you cannot serve both providers from one generated client.
- This is automated: **`npm run dev`** runs a `predev` hook (`scripts/dev-db.mjs`) that derives a
  SQLite copy of the committed Postgres schema, regenerates the client for SQLite, and syncs
  `dev.db`. So local dev "just works" on SQLite while production stays Postgres. The committed
  `prisma/schema.prisma` is never modified; the derived `prisma/dev-sqlite.prisma` is gitignored.
- Prefer Postgres locally (prod-accurate)? Set a `postgres://` `DATABASE_URL` (e.g.
  `docker compose up -d`); the `predev` hook then no-ops and the committed schema is used directly.
- Production/Docker builds run `prisma generate` against the Postgres schema as normal - the
  `predev` hook only runs for `npm run dev`, so the two never collide.

## Schema & models - `prisma/schema.prisma`

23 models. Core graph:

```
Workspace 1───* WorkspaceMembership *───1 User
   │                                        │
   ├─* Decision ──* DecisionNote ─* NoteReply
   │     ├─* DecisionReview   ├─* DecisionLink
   │     ├─* DecisionEvent (audit)  ├─* DecisionVersion (snapshots)
   │     ├─* DecisionRelation (graph edges)  ├─* DecisionReaction
   │     └─* DecisionTag *─1 Tag
   ├─* ActionItem        ├─* DecisionTemplate
   ├─* WorkspaceIntegration (encrypted config)
   ├─ SlackWorkspaceLink   ├─ WorkspaceSsoConfig
   └─* InAppNotification / AnalyticsEvent / NotificationLog
```

Modeling notes:
- **Enums are stored as `String`** (status, role, category, priority, relationType, …) with
  app-level defaults - no DB-level CHECK yet. Moving to Postgres-native `enum` is a backlog item.
- **JSON is stored as `String`** (`consultedIds`, `*Json` audit/version blobs, encrypted
  `configJson`). Postgres `jsonb` is a future improvement.
- **Audit trail:** most mutations also write a `DecisionEvent`; edits snapshot to
  `DecisionVersion`. These are created in the same `$transaction` as the change.

## Indexes

Hot-path `@@index`es were added for cloud scale (cron and list queries previously full-scanned):

- `Decision`: `workspaceId`, `[workspaceId, status]`, `reviewDate`, `ownerUserId`, `updatedAt`
- child tables (`DecisionNote/Link/Review/Event/Version`): `decisionId` (+ `userId` where queried)
- `DecisionRelation`: `fromDecisionId`, `toDecisionId`
- `ActionItem`: `workspaceId`, `assigneeId`, `[workspaceId, status]`
- `InAppNotification`: `[userId, isRead]`

## Migrations

- `prisma/migrations/<ts>_init/migration.sql` - Postgres baseline covering **all 23 models**
  (23 tables, 21 indexes, 35 FKs). `migration_lock.toml` provider = `postgresql`.
- Applied with `prisma migrate deploy` (runs automatically on container start via the
  Dockerfile `CMD` in the lean ECS deployment).
- The migration was generated with `prisma migrate diff --from-empty --to-schema` (no live DB
  needed), so it's deterministic from the schema.

## Transactions & access patterns

- Multi-write operations use `prisma.$transaction([...])` (reviews, notes, archive, supersede)
  so the change and its audit event commit together.
- Reads are workspace-scoped: queries filter by `session.workspaceId` (enforced in the API layer).
- Connection pooling: `pg` Pool `max` defaults to 5 per instance; put a pooler (RDS Proxy /
  PgBouncer) in front for high fan-out - see [deploy docs](../../deploy/aws-ecs/docs/ARCHITECTURE.md).
