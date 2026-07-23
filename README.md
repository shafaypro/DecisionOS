<div align="center">

<img src="public/logo.svg" alt="DecisionOS logo - two rounded pillars, blue and red" width="96"/>

<h1>DecisionOS</h1>

**The structured system of record for decisions that matter.**  
Capture what was decided, why, who decided it, alternatives considered, assumptions & risks - and whether it actually worked.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-v7-2d3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

[![CI](https://img.shields.io/github/actions/workflow/status/shafaypro/DecisionOS/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/shafaypro/DecisionOS/actions/workflows/ci.yml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-6366f1?style=flat-square)](CONTRIBUTING.md)
[![Self-hosted](https://img.shields.io/badge/self--hosted-ready-22c55e?style=flat-square)](docs/deployment/README.md)
[![Docs](https://img.shields.io/badge/docs-decisionos-526cfe?style=flat-square)](https://shafaypro.github.io/DecisionOS/)
[![Code of Conduct](https://img.shields.io/badge/Contributor%20Covenant-2.1-8b5cf6?style=flat-square)](CODE_OF_CONDUCT.md)
[![GitHub stars](https://img.shields.io/github/stars/shafaypro/DecisionOS?style=flat-square)](https://github.com/shafaypro/DecisionOS/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/shafaypro/DecisionOS?style=flat-square)](https://github.com/shafaypro/DecisionOS/issues)

[**📚 Documentation**](https://shafaypro.github.io/DecisionOS/) · [**🚀 Quick start**](#quick-start) · [**✨ Features**](#features) · [**🤝 Contributing**](#contributing)

</div>

---

## Overview

DecisionOS is an **open-source, self-hostable decision-tracking platform** that gives teams a structured, searchable system of record for the decisions that shape their products, engineering, hiring, and strategy. It's free, MIT-licensed, and runs anywhere - no plans, no seats, no limits.

Most teams make hundreds of decisions per quarter - and forget 90% of them within a month. DecisionOS fixes that by forcing structure at the point of decision: *what* was decided, *why*, *what alternatives were ruled out*, and *what assumptions were made*. Then it closes the loop with **scheduled outcome reviews** so teams learn whether their decisions actually worked.

---

## See it in action

![DecisionOS demo tour: sign in, browse and search decisions, open a decision record, explore the decision graph, analytics, and the audit console](docs/assets/demo.gif)

*25-second tour: sign in → decisions list and search → decision record → decision graph → analytics → security audit console.*

---

## Quick start

Run the full app locally in ~2 minutes. Requirements: Node.js 20+ and npm 10+ - **no database to install** (local dev bootstraps SQLite automatically).

```bash
git clone https://github.com/shafaypro/DecisionOS.git
cd DecisionOS
npm install
cp .env.example .env        # defaults are fine for local dev

npm run dev                 # http://localhost:3001
curl http://localhost:3001/api/seed   # in another terminal - loads the demo workspace
```

Then sign in with the seeded demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@acme.demo` | `password123` |
| Member | `sarah@acme.demo` | `password123` |
| Member | `james@acme.demo` | `password123` |

> **Going further:** the [Setup guide](docs/SETUP.md) covers everything else - environment variables, Postgres, Slack bot, OIDC SSO, email, scheduled jobs, and production deployment (Docker Compose, EC2, GCP, ECS, Kubernetes - see [deployment docs](docs/deployment/README.md)).

---

## Features

| Feature | Description |
|---|---|
| **Structured Decision Records** | Title, summary, problem statement, Solution, rationale, alternatives considered, assumptions, and risks |
| **Status Workflow** | Draft → In Review → Approved → Superseded / Deprecated / Reversed / Archived |
| **Outcome Tracking** | Mark decisions as Successful / Partially Successful / Unsuccessful / Reversed / Unknown |
| **Impact Levels** | Low / Medium / High / Critical with colour-coded badges |
| **Category System** | Engineering, Product, Hiring, Finance, Marketing, Operations, Strategy, Other |
| **Outcome Reviews** | Submit periodic reviews with a rating, summary, lessons learned, and follow-up actions; full review history per decision |
| **Notes & Comments** | Add contextual notes to any decision with threaded replies; delete your own notes and replies |
| **Resource Links** | Attach references (RFC, PR, ADR, article, etc.) with typed link categories |
| **Tag System** | Admins create colour-coded workspace tags; any member can apply/remove tags on decisions |
| **Advanced Filtering** | Filter by status, category, impact level, outcome, owner, or free-text search across titles |
| **Reviews Page** | Dedicated page showing overdue reviews, upcoming reviews, and review history across the workspace |
| **Dashboard Analytics** | Live stats - active decisions, due-for-review, recently reviewed, reversals; recent activity feed; high-impact decisions |
| **Public Share Page** | Generate a read-only shareable URL (`/share/:id`) for any workspace-visible decision - no login required |
| **CSV Export** | One-click export of all decisions to a dated `.csv` file with 23 columns including tags, review counts, and all reasoning fields |
| **Team Management** | Admins can invite members by email (creates an account if none exists), assign roles (Member / Admin), and view all workspace members |
| **Workspace Settings** | Admins can update the workspace name and slug |
| **Audit Log** | Every significant mutation (create, update, status change, note added, link added, reviewed) emits a `DecisionEvent` record |
| **Multi-tenant Workspaces** | Every user belongs to a workspace; all data is strictly scoped by `workspaceId` |
| **Platform Control Plane** | Provider super-admin layer above workspaces: a `/admin` console to see every company, **enter** one to manage it, and rename or suspend / reactivate it. Access is granted only via the `PLATFORM_ADMIN_EMAILS` allow-list - see [`docs/PLATFORM_ADMIN.md`](docs/PLATFORM_ADMIN.md) |
| **JWT Authentication** | Stateless, cookie-based sessions via `jose` - no third-party auth dependency |
| **Decision Graph** | Interactive force-directed canvas at `/graph` - nodes sized by relation count, edges colour-coded by type, pan/zoom/drag, hover to inspect, click to navigate |
| **Decision Health** | Per-decision health signal (healthy / overdue / stale / orphaned / superseded-unreviewed) - surfaced as a badge on every decision |
| **Blast Radius Badge** | Counts inbound `depends_on` relations - amber/rose pill warns you before you change a load-bearing decision |
| **Re-decide Detector** | Debounced similarity check while typing a new title - surfaces existing decisions to prevent accidental duplicates |
| **Version History** | Every edit snapshots the before-state; `/decisions/:id/history` shows a full field-diff timeline |
| **Emoji Reactions** | Six curated emoji reactions per decision (`👍 👎 👀 ⚠️ 🚀 ❓`) - one toggle per user per emoji |
| **Atomic Supersede** | Supersede flow wraps relation-create + status-flip + audit event in a DB transaction - no partial state |
| **Ask DecisionOS** | Natural-language Q&A over your decision log - ask *"why did we move off Auth0?"* and get an answer **grounded in and cited to the actual decision records**, with one-click jump-to-source. Falls back to ranked semantic retrieval when no AI key is configured, so it's useful on day one |
| **Command Palette** | `⌘K` / `Ctrl+K` global search with quick-capture mode - type a title, press Tab, add rationale, and log a decision without leaving the palette |
| **Keyboard Shortcuts** | Press `?` anywhere for the cheatsheet; `c` to create, `g d/h/r/a/t/s` to navigate, `Esc` to close overlays |
| **Slack Capture Bot** | `/decisionos log` slash command + 🔒 emoji trigger open a Block Kit modal - decisions log in 15 seconds from Slack |
| **Review-Due Slack DMs** | Nightly cron sends Slack DMs + emails to decision owners when reviews are overdue; weekly Monday digest email per user |
| **OIDC SSO** | OIDC/OAuth2 SSO (Okta, Google Workspace, Azure AD, Auth0) - auto-provisions users on first login |
| **Decision Templates** | Five built-in templates (Engineering ADR, Hiring Rubric, Product RFC, Business Go/No-Go, Operations Process) pre-fill the decision form |
| **Analytics** | Decision patterns by category - reversal rate and unhealthy rate per category, no third-party tracker |
| **Demo Seed** | One-request `/api/seed` endpoint populates a full demo workspace with decisions, reviews, notes, tags, and links |

---

## Screenshots

> Captured live from a running instance with the seeded demo workspace.

### Analytics - workspace health at a glance
![Workspace health and analytics](docs/screenshots/02-dashboard.png)

### Decision Detail - full reasoning record
![Decision Detail](docs/screenshots/04-decision-detail.png)

### Decision Graph - interactive map of how decisions connect
![Decision Graph](docs/screenshots/06-decision-graph.png)

*More screens (sign-in, decisions list, structured intake) in the [docs](https://shafaypro.github.io/DecisionOS/).*

---

## Tech stack

```
Frontend          Next.js 16.2 (App Router) · React 19 · TypeScript 5
Styling           Tailwind CSS v4 · Radix UI primitives · class-variance-authority
Data Layer        Prisma v7 (driver adapters) · PostgreSQL (prod) / SQLite (dev)
Auth              Encrypted JWE sessions (jose) · HttpOnly cookies · OIDC SSO
Testing & CI      Zero-dep smoke runner · Vitest integration suite · GitHub Actions
```

How it's put together - the layered model, request flows, data model, API reference, and the reasoning behind the architectural choices - lives in the **[architecture docs](docs/architecture/README.md)**.

---

## Roadmap

- [x] Structured decision records with full reasoning fields
- [x] Status workflow + outcome tracking
- [x] Outcome reviews with lessons learned
- [x] Notes and resource links
- [x] Tag system (admin-managed, member-applied)
- [x] Advanced filtering by status, category, impact, outcome, owner
- [x] Dashboard analytics
- [x] Public read-only share page
- [x] CSV export
- [x] Team management + invite
- [x] Audit log / decision event history
- [x] Decision graph - interactive force-directed map of how decisions relate, supersede, or conflict
- [x] Slack capture bot + email review reminders + Monday weekly digest
- [x] Decision templates by category (Engineering ADR, Hiring rubric, Product RFC, etc.)
- [x] PostgreSQL support for production deployments
- [x] Decision versioning - full field diff history with before/after timeline
- [x] AI-assisted decision drafting (Anthropic integration, per-workspace key)
- [x] Ask DecisionOS - grounded, cited natural-language Q&A over the decision log (graceful semantic-search fallback)
- [x] Platform control plane - provider super-admin console to manage all companies (enter / rename / suspend / reactivate)
- [x] Viewer role (read-only access below Member)
- [x] Bulk actions (archive multiple decisions, bulk-export filtered results)
- [x] Kanban board, My Work, activity feed, in-app notifications, and decision watching
- [x] Comment threads on notes (replies) - threaded replies with inline composer on the decision detail page

---

## Documentation

Everything beyond this page lives on the docs site: **[shafaypro.github.io/DecisionOS](https://shafaypro.github.io/DecisionOS/)** (built from [`docs/`](docs/README.md) with MkDocs).

| Area | Start here |
|---|---|
| Setup (env, Postgres, Slack, SSO, email, cron) | [docs/SETUP.md](docs/SETUP.md) |
| Architecture overview + auth flow | [docs/architecture/](docs/architecture/README.md) |
| Data model & field reference | [docs/architecture/data-layer.md](docs/architecture/data-layer.md) |
| REST API endpoint reference | [docs/architecture/api-layer.md](docs/architecture/api-layer.md) |
| Pages & frontend layer | [docs/architecture/frontend-layer.md](docs/architecture/frontend-layer.md) |
| Deployment + CI/CD (Compose, EC2, GCP, ECS, K8s) | [docs/deployment/](docs/deployment/README.md) |
| Platform admin console | [docs/PLATFORM_ADMIN.md](docs/PLATFORM_ADMIN.md) |
| GDPR / data protection | [docs/compliance/GDPR.md](docs/compliance/GDPR.md) |
| SOC 2 control mapping | [docs/compliance/SOC2.md](docs/compliance/SOC2.md) |

---

## Contributing

Contributions are welcome and appreciated 💙 - whether it's a bug report, a docs fix, or a feature. For major changes, please [open an issue](https://github.com/shafaypro/DecisionOS/issues/new/choose) first to discuss the approach.

1. Fork the repo and create a feature branch (`git checkout -b feature/my-feature`)
2. Make your changes
3. Run the checks - **all three must pass**:
   ```bash
   npm run typecheck    # TypeScript
   npm run lint         # ESLint
   npm run test:smoke   # zero-dep smoke suite (add one for new pure logic)
   ```
4. Commit ([Conventional Commits](https://www.conventionalcommits.org/)), push, and open a PR targeting `main`

New here? Look for [**good first issue**](https://github.com/shafaypro/DecisionOS/labels/good%20first%20issue) labels. The full guide - local setup, project structure, scripts, and architecture constraints - is in **[CONTRIBUTING.md](CONTRIBUTING.md)**. Security reports go through the [security policy](SECURITY.md); community standards are in the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

MIT © [shafaypro](https://github.com/shafaypro)

---

<div align="center">
  <sub>Built with Next.js 16 · Prisma v7 · Tailwind CSS v4 · React 19</sub>
</div>
