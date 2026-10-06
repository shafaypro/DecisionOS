# Changelog

All notable changes to DecisionOS are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Invitations people can accept.** Inviting a new address emails a
  single-use, 7-day set-password link. Without SMTP, the admin sees the link
  to pass on. The invitee picks a name and password and is signed straight
  in. Previously the account got a random password that was never sent.
- **Password reset.** "Forgot password" on the sign-in page sends a
  single-use, one-hour link and answers the same whether or not the account
  exists.
- **Role management.** Admins change roles and remove members from /team. The
  last admin is protected. API authorization also checks the live role, so a
  demotion applies on the member's next request.
- **Opt-in public sharing.** A decision becomes public only when someone
  creates a link from its Share panel. The link is `/share/<random-token>`
  and can be revoked. Admins can switch public links off workspace-wide,
  which revokes them all. Public pages are `noindex`.
- **On the decision page:** action items (add, assign, tick done), removing
  relations, accountable (DRI) and consulted people, and a private/workspace
  switch for the author. The new-decision form gains a Private option.
- **Suggest framing with AI** on the new-decision form when a model is
  configured. It fills empty problem, alternatives, assumptions, and risks
  fields, never the rationale.
- OpenAPI documents the sharing and team endpoints.
- **Category, impact, and summary on the new-decision form**, and inline editing
  of all three on the decision page. Previously the web form never sent them,
  so every web-created decision landed as "Other" / "Medium" with no way to
  change it - skewing filters, analytics, and the risk register.
- **Templates on the new-decision form.** The built-in and workspace templates
  are offered as one-click chips that fill only the fields still empty. Built-in
  templates now ship in code (`src/lib/builtin-templates.ts`), so every
  deployment has them, not only ones that ran the demo seed.
- **Tag picker on the decision page** - apply and remove workspace tags where
  the record-quality meter asks for them. Tags existed but could not be applied
  from the UI.
- Sidebar entries for **My work**, **Board**, and **Tags**, and a **Decision
  templates** card in Settings - these pages existed but nothing linked to them.
- Per-page browser tab titles (`Reviews · DecisionOS`, the decision's own title
  on its page).
- Review follow-up actions are shown in a decision's review history.
- The demo seed (`/api/seed`) now includes action items and tags, so the board,
  My work, and tag filters aren't empty on first run.
- `docs/ROADMAP.md`: product evaluation and the prioritized improvement plan.

- **Search query language.** The decisions search box and
  `GET /api/decisions/search` now accept GitHub-style filters -
  `status:`, `category:`, `impact:`, `outcome:`, `owner:` (with `owner:me`),
  `tag:`, `health:`, `before:` / `after:` (absolute or relative like `30d`), and
  the `is:mine|unowned|overdue|draft|reviewed|private` shorthands. Repeating a
  field ORs its values, a `-` prefix excludes, and quoted phrases are kept
  intact. Unknown filters and unparseable dates degrade to free text with a
  visible warning rather than silently returning nothing. Documented in
  `docs/SEARCH.md`, with an in-app cheatsheet next to the search box.
- **Markdown and JSON exports.** `GET /api/decisions/export?format=json|md|csv`
  now returns a versioned JSON envelope or a Markdown bundle in addition to CSV,
  and `GET /api/decisions/:id/markdown` exports a single decision as an
  ADR-shaped file with YAML front matter.
- **Record quality score.** A weighted completeness score per decision -
  rationale and alternatives carry the most weight, stub answers earn half
  credit - shown on the decision page with the highest-value missing fields as
  next actions, and rolled up across the workspace on Analytics.
- **Risk register** at `/risks`: every recorded risk and assumption across active
  decisions, ranked by impact and by whether anyone has re-checked the decision
  lately.
- **Trends and cycle times on Analytics.** 12-month throughput and review
  sparklines, review compliance, median time-to-decide and review lag, momentum
  against the prior 30 days, and outcome success rate - also served as JSON at
  `GET /api/analytics/trends`.
- **Markdown rendering** for decision fields, notes, and reviews, via a
  dependency-free renderer that HTML-escapes the whole input before emitting any
  tag and allows only `http`/`https`/`mailto` link targets.
- **OpenAPI 3.1 document** at `GET /api/openapi`, with its server URL following
  the deployment, plus `docs/API.md` covering scripting and export formats.
- Keyboard shortcut `G K` for the risk register.

### Security

- **Breaking:** `/share/<decision-id>` URLs no longer work. Public pages are
  served only for decisions someone explicitly shared, at a random token URL.
- About a dozen decision API routes (notes, replies, reviews, links,
  relations, versions, watch, archive, tags, action items, and
  `PUT /api/decisions/:id`) checked only the workspace, so any member who
  knew a private decision's id could read or edit it. They now return 404.
  "Related decisions", the board, My work, and `GET /api/action-items` no
  longer reveal the titles of other people's private decisions.
- Only a decision's author or an admin can change its visibility.
- Dependencies: next 16.3.8 (critical advisory), nodemailer 10, and a
  webpack-dev-middleware override, plus transitive fixes. The CI audit now
  blocks on high or critical advisories in production dependencies and on
  critical ones anywhere.

- **Private decisions are now private everywhere.** The decisions list, the
  decision and history pages, reviews, the graph, the board, and My work
  ignored `visibility`, so a private decision was readable by the whole
  workspace in the UI even though search, Ask, and exports hid it.
- Decision writes now validate `status`, `category`, `impactLevel`, and
  `visibility` against the documented vocabulary. Free strings were accepted
  before - a `visibility` typo silently made a decision private.

- CSV exports now neutralize spreadsheet formula injection (cells beginning with
  `= + - @` are quoted as literal text).
- SSO login is refused when the identity provider reports the email as
  unverified, closing an account-takeover path.
- The action-items update endpoint now validates its body and keeps a re-pointed
  decision inside the caller's workspace.

### Fixed

- `.env.example` shipped active placeholder SMTP settings, so every
  email-sending request in a fresh setup waited on an unreachable server.
  SMTP is commented out by default, and sends now time out after 10 seconds.
  `NEXT_PUBLIC_APP_URL` defaults to `http://localhost:3001`, not a placeholder
  domain.
- Signed-in members opening a `/share/...` or set-password link were
  redirected away.
- Quick capture (Cmd/Ctrl+K) logs decisions as *proposed* unless marked
  already decided. Archived decisions are out of the default list. Failed
  board moves and deletes roll back. The board's decision picker lists every
  decision.
- Signup keeps what you typed after a server-side error.

- Status vocabulary drift: `draft` (written by "Save as draft") was missing from
  the status list, and the demo seeds wrote legacy values (`decided`,
  `validated`, `under_review`) that showed as raw enum text and could not be
  filtered. A migration folds legacy rows into the current workflow and the API
  maps the legacy spellings on input.
- Rescheduling a review after one was submitted now re-arms it; before, a
  reviewed decision never came due again.
- Dialogs no longer steal focus on every keystroke (typing in the delete-account
  confirmation or the relation search knocked focus out), Tab now stays inside
  an open dialog, and a drag that ends on the backdrop no longer closes it.
- Unread and reviews-due counts in the sidebar were white text on a light
  background; they are now visible pills and are announced to screen readers.
- Archive and the note / reply / link / tag delete buttons report failures
  instead of silently refreshing; inline edits keep the typed text when a save
  fails, and the supersede-on-create link reports a failure.
- Hover-only delete buttons are reachable by keyboard; the mobile navigation
  drawer closes on Esc and is no longer tab-reachable while hidden; page content
  no longer sits under the floating menu button on phones.
- Badges no longer wrap mid-label; the decisions list separates title from
  summary; the capture-quality score on the form is readable.

- The notification badge now reflects the true unread count instead of only the
  most recent 30 notifications.
- AI drafting returns a clean 400 on a malformed request body instead of a 500.

### Changed

- Documentation truthfulness pass: corrected the local database-setup steps
  (`npm run dev` bootstraps SQLite; `prisma migrate dev` targets Postgres),
  removed a retired free-tier/plans reference, documented `COOKIE_SECURE` and the
  `ANTHROPIC_MODEL`/`ANTHROPIC_BASE_URL` overrides, and refreshed the feature,
  API, page, and data-model listings to match what ships.
- Tightened the Content-Security-Policy (dropped unused payment-provider origins).

### Internal

- Test suites are now type-checked in CI (`tsconfig.test.json`).
- Added smoke coverage for CSV escaping, Zod schemas, request-context
  observability, activity-feed labels, and webhook senders; the smoke runner now
  enforces a per-test timeout.

## [0.1.0] - 2026-07-02

Initial public, open-source release.

### Added

- **Decision system of record** capture the decision, rationale, alternatives,
  assumptions, and risks; plus versioning, a typed relations graph, templates,
  tags, and full-text search.
- **Outcome reviews** scheduled review reminders over email and Slack, with
  one-click magic-link responses to close the loop.
- **Slack capture bot** log decisions from any channel via a slash command or an
  emoji reaction, with no login required.
- **Single sign-on** OIDC/OAuth2 (Okta, Google Workspace, Azure AD, Auth0), with
  auto-provisioning on first login.
- **Security audit trail** immutable, tamper-evident log of security-relevant
  actions, an admin console, a read API, and a nightly retention purge.
- **GDPR data-subject flows** self-serve personal-data export and account or
  workspace erasure.
- **Platform console** a provider control plane for the instance operator to
  manage workspaces across tenants.
- **First-party analytics** and an "Ask DecisionOS" retrieval feature, with no
  third-party trackers.

### Deployment

- Self-host targets: Docker Compose, AWS EC2, GCP, AWS ECS, and Kubernetes.
- CI/CD on GitHub Actions with container images published to GHCR.

### Notes

- Open source under the MIT License. No paid plans, seats, or usage limits.

[0.1.0]: https://github.com/shafaypro/DecisionOS/releases/tag/v0.1.0
