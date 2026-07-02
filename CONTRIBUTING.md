# Contributing to DecisionOS

Thank you for your interest in contributing. This document covers everything you need to get a working local environment, understand the project conventions, and submit a pull request.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local setup](#2-local-setup)
3. [Project structure](#3-project-structure)
4. [Architecture constraints](#4-architecture-constraints)
5. [Branch and commit conventions](#5-branch-and-commit-conventions)
6. [Submitting a pull request](#6-submitting-a-pull-request)
7. [Code style](#7-code-style)
8. [Testing](#8-testing)
9. [Reporting bugs](#9-reporting-bugs)

---

## 1. Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Git | 2.40+ |

No database install is required - SQLite is bundled via the `@libsql/client` adapter.

---

## 2. Local setup

```bash
git clone https://github.com/shafaypro/DecisionOS.git
cd DecisionOS
npm install

# Set up environment
cp .env.example .env
# Edit .env - set SESSION_SECRET to any 32+ char string for local dev
# Keep DATABASE_URL="file:./dev.db" for the zero-install SQLite local setup.

# Start the dev server. `npm run dev` runs a predev hook (scripts/dev-db.mjs)
# that generates the SQLite Prisma client and syncs dev.db automatically -
# no manual `prisma generate` / `prisma db push` needed for local SQLite.
npm run dev
# In another terminal:
curl http://localhost:3001/api/seed
```

> Production targets PostgreSQL. Because Prisma v7 locks the generated client to the schema's
> provider, local SQLite is set up by the `predev` hook against a derived schema; the committed
> `prisma/schema.prisma` stays Postgres. To develop against Postgres locally, set a `postgres://`
> `DATABASE_URL` (e.g. `docker compose up -d`) and the hook no-ops.

Open [http://localhost:3001](http://localhost:3001) and sign in with `admin@acme.demo` / `password123`.

For the full setup guide including Slack, SSO, and deployment, see [`docs/SETUP.md`](docs/SETUP.md).

---

## 3. Project structure

```
src/
├── actions/          Server actions (auth only; all other mutations use API routes)
├── app/
│   ├── (app)/        Protected routes - session required
│   ├── api/          REST API route handlers (all state-changing operations)
│   ├── login/        Public auth pages
│   └── share/        Public read-only decision share page
├── components/
│   ├── decisions/    Decision-specific components
│   ├── graph/        Interactive decision graph canvas
│   ├── layout/       App shell (sidebar, nav)
│   ├── search/       Command palette
│   └── ui/           Primitive UI components (Button, Card, Badge, etc.)
└── lib/
    ├── analytics.ts      First-party event tracking
    ├── audit.ts           Audit-trail catalog + secret redaction (pure); writer in audit-log.ts
    ├── decision-health.ts Health signal computation
    ├── email.ts           Nodemailer wrapper
    ├── graph-layout.ts    Force-directed layout engine
    ├── rate-limit.ts      Token-bucket rate limiter
    ├── session.ts         JWT create/get/delete
    ├── similarity.ts      Jaccard similarity for re-decide detection
    ├── slack/             Slack API client, modal builder, HMAC verify
    └── sso.ts             OIDC/OAuth2 SSO helpers
```

---

## 4. Architecture constraints

Read these before making changes. They are not preferences - they are required by real bugs or platform limitations.

### No server actions inside `(app)` layout (except logout)

Turbopack 16.2.x has a bug where all server action dispatches in a layout tree are misrouted to the layout's action ID. All mutations use `fetch()` to REST route handlers in `src/app/api/`. **Do not add new server actions inside `src/app/(app)/`.**

### Prisma v7 requires an explicit driver adapter

The client is generated into `src/generated/prisma/` (not `node_modules/@prisma/client`). The adapter is configured in `prisma.config.ts` and instantiated in `src/lib/prisma.ts`. Do not import from `@prisma/client` directly.

### `proxy.ts` is the auth guard - not `middleware.ts`

Next.js 16's convention changed. The auth guard is in `src/proxy.ts` and exports a `proxy` function. Modifying `middleware.ts` will have no effect.

### `DATABASE_URL` must point to the project root

`file:./dev.db` is relative to the project root, not `./prisma/dev.db`. The Prisma migrations and the running app must agree on this path.

### `SESSION_SECRET` must be consistent across environments

The secret encrypts JWT session cookies (JWE/A256GCM) and AES-256-GCM integration secrets stored in the database. Changing it in production invalidates all active sessions and makes stored Slack/SSO credentials unreadable.

---

## 5. Branch and commit conventions

### Branch names

```
feature/<short-description>
fix/<short-description>
docs/<short-description>
chore/<short-description>
refactor/<short-description>
```

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add decision graph export as PNG
fix: correct rate-limit key isolation for workspace-scoped endpoints
docs: update SSO setup guide with Okta screenshots
chore: upgrade Prisma to v7.2
refactor: extract email templates into src/lib/email-templates/
```

The first line is the commit message. Keep it under 72 characters. Add a blank line and a body if the change needs explanation.

---

## 6. Submitting a pull request

1. Fork the repo and create a branch off `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes. Run the checks:
   ```bash
   npx tsc --noEmit   # must pass
   npm run lint        # must pass
   npm run test:smoke  # must pass
   ```

3. Push and open a PR against `main`. Include in the PR description:
   - **What** changed and **why**
   - Any migration steps or breaking changes
   - Screenshots for UI changes

4. A maintainer will review. Please respond to review comments within 7 days, or the PR may be closed.

**For significant changes** (new features, data model changes, integrations), open an issue first to discuss the approach before writing code.

---

## 7. Code style

- **TypeScript strict mode** - no `any` unless unavoidable; add a comment explaining why.
- **No comments for obvious code** - name things well instead. Comments should explain *why*, not *what*.
- **No default exports from lib files** - use named exports for tree-shaking and explicit imports.
- **Tailwind utility classes** - avoid custom CSS unless Tailwind genuinely cannot express it.
- **Client components only when needed** - prefer React Server Components. Add `"use client"` only when the component needs browser APIs, state, or event handlers.
- **All mutations go through API routes** - see Architecture constraints above.
- **Run `npx tsc --noEmit` before committing** - do not suppress TypeScript errors with `@ts-ignore` or `as any` as a shortcut.

EditorConfig (`.editorconfig`) handles indentation, line endings, and trailing whitespace automatically. Use an editor that respects it.

---

## 8. Testing

The smoke test suite lives in `tests/smoke/` and runs zero-dependency pure-function tests:

```bash
npm run test:smoke
```

When adding a feature with non-trivial pure logic (e.g. a new computation in `src/lib/`), add a corresponding test suite and register it in `tests/smoke/run.ts`.

The current suites:

| Suite | What it covers |
|---|---|
| `slack-hmac` | HMAC signing, replay window, tampered body |
| `rate-limit` | Token-bucket exhaustion, key isolation, window reset |
| `decision-health` | All 8 health states and precedence rules |
| `similarity` | Tokenizer, Jaccard, threshold sanity |
| `graph-layout` | Seed positions, bounds, determinism, spring attraction |
| `decision-retrieval` | Ranking/field-weighting, snippet extraction, grounded-prompt construction, citation parsing |
| `session` | Encrypted-cookie (JWE/A256GCM) round-trip, tamper/format rejection |
| `api-foundation` | Role authorization levels + tenant-scoping `where` builders |
| `platform-auth` | Platform super-admin allow-list + `/admin` console authorization |
| `audit` | Audit action catalog (closed set), secret redaction, request attribution |

### Integration tests (Vitest)

Integration tests exercise real API route handlers against a real database
(SQLite locally and in CI, Postgres-compatible logic) with a mocked session:

```bash
npm run test:integration   # vitest run
npm test                   # smoke + integration
```

`tests/integration/tenancy.test.ts` asserts the guarantees that matter most for a
multi-tenant SaaS: **cross-tenant isolation** (workspace A can't read workspace
B), **per-decision visibility** (private decisions hidden from non-creators), and
**role authorization** via the `withApi` wrapper. Add integration coverage when a
route touches tenancy or authorization.

---

## 9. Reporting bugs

Open a [GitHub Issue](https://github.com/shafaypro/DecisionOS/issues) with:

- **Steps to reproduce** (exact sequence)
- **Expected behaviour**
- **Actual behaviour**
- **Environment** (OS, Node version, browser if UI)
- **Relevant logs** (from the browser console or `npm run dev` output)

For security vulnerabilities, do **not** open a public issue. Email the maintainer directly.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
