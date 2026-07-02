# GDPR notes (records of processing and security)

A working record of how DecisionOS handles personal data, for GDPR purposes. This
documents what the application does today. The customer-facing policy text lives at
`/privacy` and `/terms`; legal review of those is still the operator's responsibility.

## Roles

- For data a customer puts into a workspace, the customer organisation is the
  **controller** and DecisionOS is the **processor**.
- For account-level data (name, email), DecisionOS is the **controller**.

## Data inventory (what personal data, and where)

| Data | Where it lives | Notes |
|---|---|---|
| Name, email | `User` table (Postgres on the EC2) | email is unique; used for login and notifications |
| Password | `User.passwordHash` | bcrypt hash, never plaintext |
| Decisions, notes, reviews, links, versions, events, reactions | Postgres | the user's content and audit trail |
| Workspace membership and role | `WorkspaceMembership` | |
| Product events | `AnalyticsEvent`, `DecisionEvent` | first-party, no third-party trackers |
| Security audit trail | `AuditLog` table (Postgres) | who did what to security-relevant resources; stores actor email, IP, and user-agent for attribution. Secrets are never written (redacted by `src/lib/audit.ts`). Legitimate-interest basis; see Retention |
| IP address | rate-limit buckets (in-memory / Redis), and `AuditLog` rows | transient in rate-limit buckets; persisted in the audit trail for security attribution (legitimate interests) |
| Server logs | container stdout (shipped to CloudWatch) | structured JSON; scrubbed of secrets before error reporting |

## Lawful basis

- Providing the service: performance of a contract.
- Security, abuse prevention, audit/security logs: legitimate interests.

DecisionOS is open source with no paid plans, so there is no payment processing
and no billing data.

## Sub-processors

- **AWS, eu-west-1 (Ireland):** hosting, database, container registry, logs. Data is EU-resident.
- **Optional, per workspace:** SMTP email provider (notifications), Slack (capture),
  Sentry / error monitoring (only if `SENTRY_DSN` is set; payloads are scrubbed of
  authorization, token, secret, password, and email fields before sending).

## Data-subject rights (how each is exercised in the app)

| Right | How |
|---|---|
| Access / portability | Settings -> "Download my data" -> `GET /api/account/export` returns a JSON bundle of the user's personal data. The request itself is recorded in the audit trail (`account.data_exported`) |
| Erasure | Settings -> Danger zone -> "Delete my account" (`DELETE /api/account`) or, for admins, "Delete workspace" (`DELETE /api/settings/workspace`). Deletes cascade across all child records in the schema |
| Rectification | name, email, and workspace name/slug are editable in the app |
| Restriction / objection | contact the instance operator |

Account deletion is blocked if the user is the sole admin of a workspace (so a
workspace is not orphaned); they must delete or reassign the workspace first.

## Security measures

- Encryption at rest for session cookies (`src/lib/session-crypto.ts`, JWE / A256GCM)
  and stored secrets such as integration, SSO, and Slack credentials
  (`src/lib/crypto.ts`, AES-256-GCM with per-record salt and IV).
- Passwords hashed with bcrypt.
- Per-tenant and per-role access control on every workspace-scoped route
  (`withApi` / `authorizeRole`, `withPlatformApi` for the cross-tenant console).
- Immutable, tamper-evident audit trail of security-relevant events -
  authentication (incl. failed logins), membership, integrations, SSO, and the
  GDPR data-subject actions above (`src/lib/audit.ts` + `AuditLog`). Admins view
  it at **Settings -> Audit log**; it is append-only and exposes no mutation API.
- HTTPS is available via Caddy auto-TLS when a domain is configured (currently the
  demo runs over HTTP on an IP; see the deployment runbook to enable a domain).

## Data residency

The deployment runs on AWS **eu-west-1 (Ireland)** with a self-hosted Postgres on the
instance, so customer data stays within the EEA. Any sub-processor outside the EEA
(none required for the core service) would need an appropriate transfer safeguard.

## Retention

Personal data is kept while the account or workspace is active and removed on deletion.
Application logs in CloudWatch should have a retention policy set on the log group so
they expire (keeps cost and retention bounded).

The `AuditLog` trail is intentionally **not** cascade-deleted with the user or
workspace it references (the actor is denormalized with no foreign key), so a
deletion event remains provable after the fact - this is the point of a SOC 2
audit trail. Its growth is bounded by a scheduled purge: the
`/api/cron/audit-retention` route (nightly) deletes rows older than
`AUDIT_RETENTION_DAYS` (default ~18 months). Set a shorter window for stricter
data minimization or a longer one for a stricter audit commitment; an invalid or
non-positive value falls back to the default rather than purging everything.

## Still the operator's responsibility (not code)

- A customer-facing Data Processing Agreement (DPA).
- A documented data-breach notification process.
- Legal review of the `/privacy` and `/terms` text for the specific jurisdiction and use.
