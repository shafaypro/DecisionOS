# DecisionOS - Setup Guide

End-to-end setup: from a fresh clone to production with Slack capture,
email reminders, SSO, and Vercel cron.

This doc is written so you can follow it **top to bottom** without jumping
around. Every step tells you what you'll have working when it's done.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Clone and install](#2-clone-and-install)
3. [Environment variables](#3-environment-variables)
4. [Database: schema and migrations](#4-database-schema-and-migrations)
5. [Run locally](#5-run-locally)
6. [Create your first workspace](#6-create-your-first-workspace)
7. [Email (review reminders and weekly digest)](#7-email-review-reminders-and-weekly-digest)
8. [Scheduled jobs (Vercel Cron)](#8-scheduled-jobs-vercel-cron)
9. [Slack capture bot](#9-slack-capture-bot)
10. [Single Sign-On (OIDC)](#10-single-sign-on-oidc)
11. [AI drafting with Anthropic (optional)](#11-ai-drafting-with-anthropic-optional)
12. [Deploy to Vercel](#12-deploy-to-vercel)
13. [Analytics and operational queries](#13-analytics-and-operational-queries)
14. [Troubleshooting](#14-troubleshooting)
15. [Platform admin (provider control plane)](#15-platform-admin-provider-control-plane)
16. [Product-specific features](#16-product-specific-features)
17. [Interactive UX surface](#17-interactive-ux-surface)
18. [Smoke tests](#18-smoke-tests)

---

## 1. Prerequisites

You'll need:

- **Node.js 20+** (the project uses Next.js 16 and modern Node APIs)
- **npm 10+** (or pnpm/yarn - examples use npm)
- **SQLite** is bundled via the libsql adapter; no separate install
- A **Slack** workspace where you can install apps (only for the capture bot)
- An **SMTP** account (Gmail, Postmark, SES, Resend, etc.) for review reminder emails

> DecisionOS also runs against **PostgreSQL** - see step 4.

---

## 2. Clone and install

```bash
git clone <your fork or origin> decisionos
cd decisionos
npm install
```

Generate the Prisma client (required before first build):

```bash
npx prisma generate
```

---

## 3. Environment variables

Copy the template and edit values:

```bash
cp .env.example .env
```

### Required (to boot the app)

| Variable         | What it is                                                      | Example                                   |
| ---------------- | --------------------------------------------------------------- | ----------------------------------------- |
| `DATABASE_URL`   | Prisma connection string (SQLite or Postgres)                   | `file:./dev.db`                           |
| `SESSION_SECRET` | 32+ char random string - used for JWT sessions AND AES-256-GCM for integration secrets. **Do not change it in production** or you'll lose the ability to decrypt stored Slack/SSO secrets. | `openssl rand -hex 32` output |
| `NEXT_PUBLIC_APP_URL` | Base URL of your deployment - required for magic links and Slack redirects | `http://localhost:3001` (dev) / `https://decisions.acme.com` (prod) |

### Optional at boot; required when you turn on a feature

- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Cron auth: `CRON_SECRET` (random string; required in prod)
- Slack: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
- AI drafting: `ANTHROPIC_API_KEY`
- Platform admins: `PLATFORM_ADMIN_EMAILS` (comma-separated; grants the `/admin` provider console - see [§15](#15-platform-admin-provider-control-plane))

The app treats any of these as "feature disabled" when missing - it will not
crash, it will show an inline hint in the relevant settings page.

---

## 4. Database: schema and migrations

### SQLite (default - dev and light prod)

The default `DATABASE_URL="file:./dev.db"` just works. Push the schema:

```bash
npx prisma db push
npx prisma generate
```

### PostgreSQL (recommended for real prod)

Set `DATABASE_URL="postgres://user:pass@host:5432/decisionos"`. Prisma
autodetects the protocol (see `src/lib/prisma.ts`) and swaps to the
`@prisma/adapter-pg` adapter.

```bash
npx prisma db push
npx prisma generate
```

> You don't need `prisma migrate` for a greenfield install. When the schema
> changes later (bumps to `prisma/schema.prisma`), run `npx prisma db push`
> again, or switch to `prisma migrate` if you want versioned migrations.

---

## 5. Run locally

```bash
npm run dev
```

DecisionOS defaults to **http://localhost:3001** (Next.js dev server). Open it
and you'll see the login screen.

---

## 6. Create your first workspace

1. Go to `/signup`.
2. Enter your name, email, workspace name, and password.
3. You're dropped into `/decisions` as the workspace **admin**.

The first admin can:
- Invite teammates from `/team`
- Configure integrations at `/settings/integrations`
- Configure SSO at `/settings/sso` (step 10)

> DecisionOS is open source with no plans or limits - unlimited members and
> decisions per workspace.

---

## 7. Email (review reminders and weekly digest)

Without SMTP set, email calls log to the console - you can test the flow in
dev without sending real mail.

### 7a. Gmail (easy, dev)

1. Enable 2-step verification on the Google account.
2. Create an **App Password** at <https://myaccount.google.com/apppasswords>.
3. Fill `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@yourcompany.com
SMTP_PASS=<16-char app password>
SMTP_FROM="DecisionOS <decisions@yourcompany.com>"
```

### 7b. Postmark / Resend / SES (prod)

Use the SMTP credentials your provider issues. `SMTP_FROM` must be a
verified sender on that provider.

### Test it

Trigger a review reminder manually (step 8 explains the cron):

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3001/api/cron/review-reminders
```

---

## 8. Scheduled jobs (Vercel Cron)

`vercel.json` registers three crons:

| Path                            | Schedule (UTC) | What it does                                       |
| ------------------------------- | -------------- | -------------------------------------------------- |
| `/api/cron/review-reminders`    | `0 8 * * *`    | Daily, emails owners of overdue decisions with one-click "Still valid / Assumptions changed" magic-link buttons. Also sends a Slack DM to users who have linked their Slack account. |
| `/api/cron/weekly-digest`       | `0 9 * * 1`    | Monday, emails each user a digest with a **decision debt** summary, overdue reviews, recent team decisions, and upcoming reviews. |
| `/api/cron/audit-retention`     | `37 3 * * *`   | Daily, prunes audit-trail entries older than the configured retention window (`AUDIT_RETENTION_DAYS`). |

### Protect the endpoints

Set `CRON_SECRET` to a random string. The routes reject any request whose
`Authorization: Bearer <secret>` header doesn't match. **Never leave this
blank in production.**

Vercel's cron runner sends the right header automatically when you put
`CRON_SECRET` in the project's Environment Variables.

### Running in other environments

These are plain HTTP endpoints. Use any scheduler (GitHub Actions, a systemd
timer, Render/Fly cron, Upstash QStash) - just call them with the header.

---

## 9. Slack capture bot

The Slack bot is DecisionOS's must-have integration - 15-second capture
from Slack into the decision log.

### 9a. Register the Slack app

1. Go to <https://api.slack.com/apps> → **Create New App** → **From scratch**.
2. Name it `DecisionOS` (or per-customer), pick your Slack workspace.
3. Under **OAuth & Permissions** → add bot scopes:
   - `commands`
   - `chat:write`
   - `users:read`
   - `users:read.email`
   - `reactions:read`
   - `channels:history`
   - `groups:history`
   - `im:history`
   - `im:write`           ← required for review-due DMs
   - `mpim:history`
   - `conversations:open` ← required to open DM channels for review reminders
4. Add a **Redirect URL**:
   - `https://your-app-url/api/slack/oauth/callback`
5. Under **Slash Commands** → **Create New Command**:
   - Command: `/decisionos`
   - Request URL: `https://your-app-url/api/slack/commands/log`
   - Short description: `Log a team decision`
   - Usage hint: `log [title]`
6. Under **Interactivity & Shortcuts** → turn it **On**:
   - Request URL: `https://your-app-url/api/slack/actions`
7. Under **Event Subscriptions** → turn it **On**:
   - Request URL: `https://your-app-url/api/slack/events`
   - Subscribe to bot events: `reaction_added`
8. Under **Basic Information** → copy:
   - **Client ID** → `SLACK_CLIENT_ID`
   - **Client Secret** → `SLACK_CLIENT_SECRET`
   - **Signing Secret** → `SLACK_SIGNING_SECRET`

### 9b. Install into a workspace

1. As an admin in DecisionOS, go to **Settings → Integrations**.
2. Click **Install to Slack**.
3. Authorize the app in Slack.
4. You're redirected back with a green "Slack app installed" banner.

### 9c. First use

1. In any Slack channel, type `/decisionos log Move auth to Clerk`.
2. First time? Slack replies with a one-click "Link your DecisionOS account"
   link that bounces through `/slack/connect`.
3. After linking, `/decisionos log` opens a Block Kit modal with title,
   rationale, Solution, status, and optional review date.
4. Submit → the decision is created in DecisionOS, and Slack shows an
   ephemeral "✅ Decision logged - Open in DecisionOS" link.

### 9d. Emoji capture (🔒)

Add the 🔒 (`:lock:`) reaction to any message. DecisionOS posts an
**interactive thread message** with two buttons: **Log Decision** and **Dismiss**.
Clicking "Log Decision" opens the full Block Kit capture modal (the button
click provides a `trigger_id`, which Slack requires for modals - the Events
API `reaction_added` event does not). The slash command `/decisionos log`
remains the fastest path for keyboard-first users.

### 9e. Review-due Slack DMs

When the nightly review-reminders cron runs, it also sends a **Slack DM**
to any decision owner who has linked their Slack account (Settings →
Profile → Connect Slack). The DM lists overdue decisions and includes a
"Go to Reviews" button linking directly to `/reviews` in the app.

To link a Slack account from inside DecisionOS: go to **Settings →
Integrations → Slack** and click **Link my Slack account**. This creates
a `SlackUserLink` row that the cron reads at send time.

---

## 10. Single Sign-On (OIDC)

DecisionOS is open source with no paid plans, so SSO is available to every
workspace. Configure it at **Settings → Single Sign-On**.

### 10a. What to give your customer

Your customer's IdP admin (Okta / Google Workspace / Azure AD / Auth0 /
JumpCloud) needs:

| Value                      | Where to find it                                                           |
| -------------------------- | -------------------------------------------------------------------------- |
| Redirect / Callback URL    | `https://your-app-url/api/auth/sso/<workspace-slug>/callback`              |
| Login URL for end users    | `https://your-app-url/login?sso=<workspace-slug>`                           |
| Scopes                     | `openid email profile`                                                     |
| Response type              | `code` (authorization code flow)                                           |

### 10b. What you configure in DecisionOS

Admin → **Settings → Single Sign-On**, fill in:

- **Issuer URL** - e.g. `https://acme.okta.com`
  (we discover endpoints at `{issuer}/.well-known/openid-configuration`)
- **Client ID** / **Client Secret** - from the IdP
- **Allowed email domain** (optional but recommended) - e.g. `acme.com`
- **Enforce SSO** - check to block email/password for this workspace

### 10c. End-user login

1. User goes to `/login`, clicks **Sign in with SSO**.
2. Types the workspace slug (e.g. `acme`).
3. Redirected to the IdP, authenticates.
4. IdP sends the user back to `/api/auth/sso/acme/callback`.
5. We verify the ID token signature against the IdP's JWKS, check the
   allowed email domain, auto-provision a `User` + `WorkspaceMembership`
   if needed, and create a session.

---

## 11. AI drafting with Anthropic (optional)

Set `ANTHROPIC_API_KEY="sk-ant-api03-..."`. When set, the decision form's
AI draft assist button becomes active and helps users turn a rough
problem statement into a structured decision.

Per-workspace keys override the env var - set them in
**Settings → Integrations → Anthropic**. Keys are AES-256-GCM encrypted
via `SESSION_SECRET` before DB storage.

---

## 12. Deploy to Vercel

### 12a. First deploy

```bash
# link the repo to Vercel (one-time)
npx vercel link
# deploy
npx vercel --prod
```

### 12b. Set env vars in Vercel

In the Vercel dashboard → **Settings → Environment Variables** - add
every value from your `.env`. `SESSION_SECRET` must be the same across
environments or signed cookies/tokens from one env won't validate in another.

### 12c. Cron jobs

`vercel.json` is already in the repo. After deploy, Vercel picks up the
crons automatically. Verify at **Settings → Cron Jobs** in the Vercel UI.

### 12d. External DBs

If you switched to Postgres, set `DATABASE_URL` to the production Postgres
connection string. Run the schema push from a one-off box (or via
`vercel env pull` → `npx prisma db push` locally against prod credentials
if you're comfortable doing so).

---

## 13. Analytics and operational queries

DecisionOS writes first-party analytics to the `AnalyticsEvent` table -
no third-party tracker, no cookies.

Sample queries:

```sql
-- DAU (unique users logging decisions per day, last 30 days)
SELECT DATE(createdAt) AS day, COUNT(DISTINCT userId) AS users
FROM AnalyticsEvent
WHERE event = 'decision.created' AND createdAt >= DATE('now', '-30 days')
GROUP BY day ORDER BY day DESC;

-- Slack capture share (last 7 days)
SELECT source, COUNT(*) FROM AnalyticsEvent
WHERE event = 'decision.created' AND createdAt >= DATE('now', '-7 days')
GROUP BY source;
```

Event catalogue (`src/lib/analytics.ts`):

- Activation: `decision.created`, `decision.updated`, `decision.reviewed`,
  `decision.superseded`, `decision.archived`, `decision.shared`
- Slack: `slack.installed`, `slack.user_linked`,
  `slack.capture_started`, `slack.capture_completed`
- Growth: `signup.completed`, `workspace.created`, `invite.sent`, `member.removed`
- Retention: `review_reminder.sent`, `weekly_digest.sent`, `search.performed`

---

## 14. Troubleshooting

**Slack: "invalid_signature" on slash command**
Your `SLACK_SIGNING_SECRET` is wrong, or your load balancer is rewriting
the request body. The HMAC must be computed over the exact raw body Slack
sent - don't let a proxy JSON-parse and re-serialize it.

**Slack: "dispatch_failed" with `/decisionos log`**
Slack's 3-second timeout. Check that `NEXT_PUBLIC_APP_URL` is set and
reachable. The handler fires `views.open` asynchronously so that the HTTP
200 goes back to Slack quickly - if that promise throws before it's sent,
Slack shows `dispatch_failed`.

**Magic-link review buttons: "Invalid or expired token"**
Tokens expire after 7 days. Resending the reminder generates a fresh one.
If this happens immediately after deploy, check `SESSION_SECRET` is
identical across envs.

**SSO: "Nonce mismatch"**
The user's session rotated between `/start` and `/callback`. Usually caused
by browser privacy settings stripping the state cookie. Retry from `/login`.

**Prisma: "no such table: Decision"**
The DB file path in `DATABASE_URL` doesn't match where `db push` landed.
Double-check: `file:./dev.db` means relative to the project root - not
`./prisma/dev.db`.

---

## 15. Platform admin (provider control plane)

If you run DecisionOS as a provider hosting **multiple companies**, the platform control plane
lets your own staff manage every workspace from one place - separate from each company's own
admin.

1. **Grant access** by adding staff emails to `PLATFORM_ADMIN_EMAILS` (comma-separated):

   ```env
   PLATFORM_ADMIN_EMAILS="you@decisionos.app,ops@decisionos.app"
   ```

   This is the **only** way to grant platform access - it can never be set in the database, and
   it fails closed (unset/empty = no platform admins), exactly like `CRON_SECRET`. The role is
   read at login, so staff must sign out and back in after being added.

2. **Apply the migration** that adds `Workspace.status` (already in `prisma/migrations/`):

   ```bash
   npx prisma migrate deploy   # prod (Postgres); local SQLite is derived by `npm run dev`
   ```

3. **Sign in** as an allow-listed user → a **Platform** link appears in the sidebar, opening the
   `/admin` console. From there you can list every company, **enter** one to manage it as an
   admin, **suspend / reactivate** it, or **override its plan**.

Full walkthrough, security model, audit events, and API reference:
**[`docs/PLATFORM_ADMIN.md`](PLATFORM_ADMIN.md)**.

---

## Appendix A - Complete `.env` template

```env
# Required
DATABASE_URL="file:./dev.db"
SESSION_SECRET="change-this-to-a-long-random-secret-at-least-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3001"

# Email
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM=""

# Cron
CRON_SECRET=""

# Platform admins (provider control plane - grants the /admin console)
# PLATFORM_ADMIN_EMAILS="you@decisionos.app,ops@decisionos.app"

# AI drafting
# ANTHROPIC_API_KEY="sk-ant-api03-..."

# Slack
# SLACK_CLIENT_ID=""
# SLACK_CLIENT_SECRET=""
# SLACK_SIGNING_SECRET=""
```

## Appendix B - Route map

| Area       | Route                                                | Method | Purpose                                                      |
| ---------- | ---------------------------------------------------- | ------ | ------------------------------------------------------------ |
| Auth       | `/api/auth/sso/[slug]/start`                         | GET    | Kick off OIDC authorization                                  |
| Auth       | `/api/auth/sso/[slug]/callback`                      | GET    | Exchange code, verify ID token, create session               |
| Platform   | `/api/platform/workspaces`                           | GET    | List every company (staff-only - `withPlatformApi`)          |
| Platform   | `/api/platform/workspaces/[id]/enter`                | POST   | Enter a company (re-issues the session at that workspace)     |
| Platform   | `/api/platform/exit`                                 | POST   | Stop impersonating; return to home workspace                 |
| Platform   | `/api/platform/workspaces/[id]`                      | PATCH  | Suspend / reactivate or rename a company                     |
| Cron       | `/api/cron/review-reminders`                         | POST   | Daily review-due emails with magic links                     |
| Cron       | `/api/cron/weekly-digest`                            | POST   | Monday weekly digest emails                                  |
| Decisions  | `/api/decisions`                                     | POST   | Create a decision (logs analytics)                           |
| Decisions  | `/api/decisions/[id]/supersede`                      | POST   | Atomic supersede (relation + status flip)                    |
| Decisions  | `/api/decisions/review-action`                       | GET    | Magic-link one-click review response                         |
| Settings   | `/api/settings/sso`                                  | POST   | Save OIDC config (admin)                                     |
| Slack      | `/api/slack/install`                                 | GET    | Start OAuth install (admin only)                             |
| Slack      | `/api/slack/oauth/callback`                          | GET    | Finish OAuth, persist encrypted bot token                    |
| Slack      | `/api/slack/commands/log`                            | POST   | `/decisionos log` slash command                              |
| Slack      | `/api/slack/actions`                                 | POST   | Modal submissions                                            |
| Slack      | `/api/slack/events`                                  | POST   | `reaction_added` events                                      |
| Slack      | `/api/slack/connect-user`                            | POST   | Link DecisionOS user ↔ Slack user                            |
| Decisions  | `/api/decisions/[id]/reactions`                      | GET/POST | List or toggle emoji reactions (one row per user × emoji)  |
| Decisions  | `/api/decisions/similar`                             | GET    | Re-decide detector - token-overlap match for a candidate title |
| Decisions  | `/api/decisions/search`                              | GET    | Full-text search with ranked results (title > body, recency boost) |
| Decisions  | `/api/decisions/export`                              | GET    | Download all workspace decisions as a CSV file |
| Decisions  | `/api/decisions/[id]/versions`                       | GET    | List version snapshots for a decision (backs the history page) |

---

## 16. Product-specific features

These are features built specifically for a *decision log* - they don't make sense in a generic doc tool, and they're how DecisionOS earns its tagline. Each one is implemented as a pure module so it's directly unit-testable; the smoke runner exercises every one of them.

### 16.1 Decision health (`src/lib/decision-health.ts`)

The health signal answers a single question: **is this decision still trustworthy?** It's computed, not stored - there's no migration when the rules change. Precedence is intentional: the most actionable failure mode wins.

| State                     | Trigger                                                                  | Tone   |
| ------------------------- | ------------------------------------------------------------------------ | ------ |
| `superseded-unreviewed`   | Replaced by another decision, but no retro was ever recorded             | Rose   |
| `review-overdue`          | `reviewDate` has passed, no `reviewedAt` set                             | Amber  |
| `review-due-soon`         | `reviewDate` is within the next 7 days, no `reviewedAt` set              | Indigo |
| `stale`                   | Active, no review date set, untouched for 90+ days                       | Rose   |
| `orphaned`                | Active, has no `ownerUserId`                                             | Slate  |
| `superseded`              | Replaced by another decision, retro was recorded                         | Slate  |
| `archived`                | Intentionally archived - informational only                              | Slate  |
| `healthy`                 | Owned + on schedule + recently touched                                   | Green  |

Tunable thresholds live in `HEALTH_THRESHOLDS`. Render the badge anywhere with `<HealthBadge decision={...} />` (it accepts the same fields you'd pull from Prisma). Tests: `tests/smoke/decision-health.test.ts` covers all 8 states + precedence rules.

### 16.2 Blast radius (`src/components/decisions/blast-radius-badge.tsx`)

Counts inbound `depends_on` relations - i.e. how many other decisions in the workspace would be affected if this one were revisited. Surfaced as a pill in the decision header that links to the `#relations` anchor of the same page.

- **0 dependents** → badge hidden
- **1 dependent** → slate
- **2-4 dependents** → amber ("worth checking before you change this")
- **5+ dependents** → rose ("this is load-bearing")

The category is excluded from `supersedes` relations on purpose - those are historical, not live coupling.

### 16.3 Re-decide detector (`src/lib/similarity.ts` + `/api/decisions/similar`)

When someone starts a new decision, the form debounces a call to `/api/decisions/similar?q=<title>` (350ms) and shows up to 5 active decisions whose titles or rationales token-overlap above `SIMILARITY_THRESHOLD` (0.25 Jaccard). Soft warning, not a block - sometimes you really *do* want to re-decide. UI is `<SimilarDecisionsHint/>`.

The matcher is deliberately simple: stop-word filter + 3+ char tokens + Jaccard. No embedding store, no extra deps. Swap to embeddings later by re-implementing `similarity()` - the API contract stays the same. Tests: `tests/smoke/similarity.test.ts`.

### 16.4 Atomic supersede (`/api/decisions/[id]/supersede`)

Wraps the relation-create + status-flip + event-log in `prisma.$transaction`, so a partial failure cannot leave a decision marked superseded with no replacement record. The `<SupersedeButton/>` UI also offers "or log a brand-new decision →" which prefills `?supersedes=<id>` on the new-decision form, threading the relation through on first save.

### 16.5 Emoji reactions (`/api/decisions/[id]/reactions`)

Six curated reactions (`thumbsup`, `thumbsdown`, `eyes`, `warning`, `rocket`, `question`) - chosen for a *decision log*, not for a chat app. The unique `(decisionId, userId, emoji)` constraint makes POST a toggle: re-clicking removes. Optimistic UI with rollback on failure. Viewer role gets 403.

### 16.6 Version history (`/decisions/[id]/history`)

Every `PUT` to `/api/decisions/[id]` snapshots the full before-state into
`DecisionVersion`. The history page renders a timeline with before/after
field diffs side-by-side (red strikethrough → green). A "Decision created"
marker anchors the bottom of the timeline. Link to the page via the
**History** button on any decision detail page.

### 16.7 Lessons learned callout

When a decision has at least one review with a `lessonsLearned` field filled
in, the decision detail page surfaces the most recent one in an indigo
callout box directly above the reviews list. Includes the reviewer name,
date, and outcome badge if set.

### 16.8 Decision debt

A workspace-level integer: the sum of overdue reviews + superseded-without-retro + stale decisions. Surfaced as a rose pill in the workspace health dashboard header (`/dashboard`) and as a summary line in the Monday weekly digest email. The metric is a psychologically effective prompt for engineering teams: a single number is easier to act on than four separate counts.

### 16.9 RACI-lite fields

Every decision now has two optional accountability fields:

| Field                | Type   | Meaning                                                    |
|----------------------|--------|------------------------------------------------------------|
| `accountableUserId`  | String | Single DRI - the person ultimately accountable (Accountable in RACI) |
| `consultedIds`       | JSON   | Array of user IDs whose input was sought before deciding (Consulted in RACI) |

These appear in the decision form (pill toggles for Consulted, dropdown for Accountable DRI) and are stored on the `Decision` model. They complement `ownerUserId` (Responsible in RACI) - the intent is to capture the full approval chain without a heavy workflow engine.

### 16.10 Analytics patterns table

`/analytics` now includes a **Decision patterns - by category** table showing, per category:
- Total decisions logged
- **Reversal rate** - % of decisions that ended up reversed or superseded (green <10%, amber 10-30%, rose ≥30%)
- **Unhealthy rate** - % of decisions currently in a non-healthy, non-archived state (green <25%, amber 25-50%, rose ≥50%)

Computed in-memory after a lightweight Prisma select - no extra DB aggregation.

### 16.11 Decision graph (`/graph`)

An interactive node-graph of the whole workspace - decisions are nodes, typed
relations (`supersedes`, `depends_on`, `relates_to`, `conflicts_with`) are edges.

- **Layout** - zero-dependency force-directed simulation in `src/lib/graph-layout.ts`
  (deterministic: golden-angle spiral seeding, no `Math.random`, covered by smoke tests).
- **Canvas** - `src/components/graph/decision-graph-canvas.tsx`: plain SVG with
  wheel zoom, background pan, draggable nodes, hover detail panel (status, category,
  owner, connection count), and click-through to the decision page.
- **Visual encoding** - node size = relation count, node color = status, edge
  color/dash = relation type (legend in the corner). Hovering a node dims everything
  outside its neighborhood.
- **Filter toggle** - "Connected only" (default) hides decisions with no relations;
  "All decisions" (`?all=1`) shows every node.
- Relations are created from the decision detail page (**Add Relation**) or the
  supersede flow; the seed script creates a small starter graph.

---

## 17. Interactive UX surface

DecisionOS leans into keyboard-first interactions. These are the global affordances available everywhere inside `(app)`:

### Command palette (⌘K / Ctrl+K)
`src/components/search/command-palette.tsx` - quick-actions + decision search. Backed by `/api/decisions/search` (rate-limited per workspace + IP). Search results are ranked by match quality (exact title > prefix > contains > body-only), then by active status and recency.

**Quick-capture mode** - type a decision title (≥3 chars) and press **Tab** to expand an inline rationale textarea directly inside the palette. `Ctrl/Cmd + Enter` or the "Log decision" button saves immediately and navigates to the new decision - no page navigation required. Alternatively, the "Quick-log this decision" button appears in the empty-results state when there are no matching decisions.

### Keyboard shortcuts overlay (`?`)
`src/components/ui/shortcuts-overlay.tsx` - press `?` anywhere outside an input to open the cheatsheet. Implemented shortcuts:

| Keys           | Action                          |
| -------------- | ------------------------------- |
| `Ctrl/Cmd + K` | Open command palette            |
| `Tab`          | Quick-capture (inside palette, with a title typed) |
| `?`            | Open / close this cheatsheet    |
| `c`            | Create a new decision           |
| `g` then `h`   | Go to Health (dashboard)        |
| `g` then `d`   | Go to Decisions                 |
| `g` then `r`   | Go to Reviews                   |
| `g` then `a`   | Go to Analytics                 |
| `g` then `t`   | Go to Team                      |
| `g` then `s`   | Go to Settings                  |
| `Esc`          | Close any overlay or modal      |

Two-key sequences (`g d`, `g r`, …) have a 1.2s window. All shortcuts auto-disable when focus is inside `<input>`, `<textarea>`, `<select>`, or any contentEditable element so typing the letter `c` in a rationale never navigates away.

### Toast system (`src/components/ui/toast.tsx`)
Mounted once at the app layout. Three tones (success / error / info), 4-second auto-dismiss, manual close, `aria-live="polite"`. Use it from any client component:

```ts
const toast = useToast();
toast.success("Share link copied");
toast.error("Couldn't update reaction");
```

Already wired into the share button, supersede flow, and reactions bar (with optimistic-update rollback on error).

### Reactions bar
On any decision detail page, under the meta row. Uses `router.refresh()` after a successful toggle so any server-rendered surface that reads reactions stays in sync.

---

## 18. Smoke tests

`npm run test:smoke` runs the entire suite (zero deps; uses tsx). Currently six suites:

| Suite                                  | What it covers                                                       |
| -------------------------------------- | -------------------------------------------------------------------- |
| `slack hmac`                           | Signing-secret verification, replay window, tampered body            |
| `rate limit`                           | Token-bucket exhaustion, key isolation, window reset, headers        |
| `decision health (DecisionOS-specific)`| All 8 health states + precedence rules                               |
| `similarity / re-decide detector`      | Tokenizer, Jaccard, threshold sanity                                 |
| `graph layout (decision graph)`        | Seed positions, canvas bounds, determinism, padding, spring attraction |

When you add a feature with non-trivial pure-function logic, add a suite next to it - the runner is one `import` + one entry in `SUITES`.

---

**That's the whole stack.** If something's unclear, check the [Troubleshooting](#14-troubleshooting) section above, or inspect the event log at `AnalyticsEvent` - every meaningful state change in the app writes a row there.
