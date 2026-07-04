# Changelog

All notable changes to DecisionOS are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- CSV exports now neutralize spreadsheet formula injection (cells beginning with
  `= + - @` are quoted as literal text).
- SSO login is refused when the identity provider reports the email as
  unverified, closing an account-takeover path.
- The action-items update endpoint now validates its body and keeps a re-pointed
  decision inside the caller's workspace.

### Fixed

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
