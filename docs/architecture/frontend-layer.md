# Frontend Layer - `src/app/**` + `src/components/**`

Next.js 16 App Router. Default to **React Server Components**; `"use client"` only where a
component needs browser APIs, state, or event handlers.

## Route structure

```
src/app/
├── (app)/                  ← PROTECTED group (session required, guarded by proxy.ts)
│   ├── dashboard, decisions (+ [id], new, edit, history), board, graph,
│   │   reviews, my-work, analytics, tags, team,
│   │   settings (+ audit, integrations, sso, templates), slack/connect
│   └── layout.tsx          ← app shell: sidebar, top bar; loads session once
├── login/  signup/         ← PUBLIC auth pages (use src/actions/auth.ts server actions)
├── share/[id]/             ← PUBLIC read-only shared decision (rate-limited)
├── page.tsx                ← PUBLIC marketing landing
└── api/                    ← the API layer (see api-layer.md)
```

`src/proxy.ts` decides public vs protected (Next 16 replaces `middleware.ts`). Pages in
`(app)/` assume a valid session.

## Server vs client components

```
page.tsx  (Server Component, default)
   │  await getSession();  await prisma.<model>.findMany({ where:{ workspaceId } })
   │  → renders data to HTML on the server (no client JS for reads)
   │
   └─ renders ─▶  <DecisionForm/>, <CommandPalette/>, <DecisionGraphCanvas/>  ("use client")
                     │  local state, keyboard, canvas, dialogs
                     │  on submit: fetch("/api/...", { method })  ──▶ API layer
                     ▼
                  router.refresh()  → server re-renders with fresh data
```

- **Reads** happen in Server Components, which query Prisma directly - fast, no client
  round-trip, naturally workspace-scoped.
- **Writes** happen in client components via `fetch()` to API routes (never server actions
  inside `(app)/`). After a successful write they `router.refresh()` or update local state.

## Component taxonomy - `src/components/`

| Folder | What | Client? |
|---|---|---|
| `ui/` | Primitives: `button`, `card`, `badge`, `input`, `select`, `avatar`, `toast`, `skeleton`, `logo`, `shortcuts-overlay`, … | mostly leaf; some client |
| `layout/` | App shell: `app-shell`, `sidebar`, `top-bar`, `breadcrumbs`, `account-block`, `page-header` | client (interactive nav/drawer) |
| `decisions/` | `decision-form`, `ai-draft-button`, `similar-decisions-hint` | client |
| `graph/` | `decision-graph-canvas` (uses `lib/graph-layout`) | client (canvas) |
| `search/` | `command-palette` (⌘K) | client |
| `reviews/` | `inline-review-buttons` | client |
| `notifications/` | `notification-bell` | client |

`ui/` primitives are built on Radix UI + Tailwind v4 with `class-variance-authority`. Each
primitive has a Storybook story (`*.stories.tsx`) for isolated development.

## Design system

Brand tokens (colors, typography) live in `globals.css`; shared `<LogoMark/>` / `<Wordmark/>`
in `ui/logo`. Tailwind utility classes are preferred over custom CSS. Loading states use the
`skeleton` primitive; transient feedback uses `toast`.

## Data flow summary

```
Server Component  ──reads──▶  Prisma  ──▶  rendered HTML
       │
       └─ hydrates ─▶  Client Component  ──writes (fetch)──▶  /api/*  ──▶  Prisma
                                              │
                                       router.refresh() ─▶ Server Component re-renders
```

This split keeps the read path cheap (server-rendered, no API hop) while routing every
mutation through the validated, workspace-scoped [API layer](api-layer.md).
