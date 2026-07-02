# SOC 1 / SOC 2 control notes

A working record of how DecisionOS implements the controls a SOC 2 (Security /
Trust Services Criteria) - and the ITGC subset relevant to SOC 1 - engagement
looks for. This documents what the **application** does today. A SOC report is
issued by an auditor against the operating entity; several controls below are
organizational and remain the operator's responsibility (called out at the end).

Scope note: SOC 2 covers the five Trust Services Criteria (Security, Availability,
Processing Integrity, Confidentiality, Privacy). The core system controls live in
the Security "Common Criteria" (CC) series; that is what the app implements and
what this note maps. SOC 1 relevance is limited to the IT general controls
(logical access + change management + the audit trail) that support a customer's
financial reporting when DecisionOS is in their control environment.

## Control mapping (Common Criteria → implementation)

| Criterion | Control in the product | Where |
|---|---|---|
| **CC6.1 Logical access - authentication** | Password login (bcrypt), encrypted session cookies (JWE / A256GCM), optional enterprise SSO (OIDC) with enforced-SSO mode | `src/actions/auth.ts`, `src/lib/session-crypto.ts`, `src/lib/sso.ts` |
| **CC6.1 Logical access - authorization** | Per-tenant + per-role gate (`auth` / `writer` / `admin`) on every workspace-scoped route; separate super-admin gate for the cross-tenant console | `src/lib/api-handler.ts`, `src/lib/authorize.ts`, `src/lib/platform-authorize.ts` |
| **CC6.1 / CC6.7 Confidentiality - encryption** | Secrets (integration, SSO, Slack credentials) encrypted at rest with AES-256-GCM (per-record salt + IV); sessions encrypted, not just signed; TLS in transit via Caddy auto-TLS | `src/lib/crypto.ts`, `src/lib/session-crypto.ts`, `deploy/` |
| **CC6.2 / CC6.3 Provisioning & de-provisioning** | Invite/remove members (admin only), last-admin guard, self-serve account deletion, seat reconciliation | `src/app/api/team/`, `src/app/api/account/route.ts` |
| **CC6.6 Boundary protection** | Rate limiting on auth, invite, and export paths (token bucket, per-IP + per-identity); brute-force / enumeration throttling | `src/lib/rate-limit.ts` |
| **CC7.2 Monitoring / anomaly detection** | Structured JSON logs; error reporting with a PII/secret scrubber before any third-party egress | `src/lib/logger.ts`, `src/lib/error-reporting.ts` |
| **CC7.2 / CC7.3 Audit logging** | **Immutable, tamper-evident audit trail** of security-relevant events - sign-ins (incl. failures), membership, integrations, SSO, GDPR data-subject actions, and cross-tenant provider actions (impersonation, suspend, rename). Append-only; no mutation API; actor denormalized so the trail survives account/workspace deletion. Admin-viewable console + read API | `src/lib/audit.ts`, `src/lib/audit-log.ts`, `AuditLog` model, `src/app/(app)/settings/audit`, `GET /api/audit` |
| **CC8.1 Change management** | Conventional Commits, PR review, pre-commit gate (`tsc` / lint / smoke + integration tests), Prisma migrations checked into version control | `CONTRIBUTING.md`, `prisma/migrations/`, `tests/` |
| **CC9.2 Vendor / sub-processor management** | Documented sub-processor list and data residency | `docs/compliance/GDPR.md` |

## What the audit trail captures

Each `AuditLog` row records the action (from a closed catalog in
`src/lib/audit.ts`), the actor (user id + denormalized email), the target, the
outcome (`success` / `failure`), the source IP and user-agent, a UTC timestamp,
and redacted structured metadata. Secrets can never be persisted: metadata is run
through `redactAuditMetadata`, which strips credential-shaped keys and values.

Audited actions today:

```
auth.login            auth.login_failed     auth.sso_login
auth.signup           auth.logout
member.invited        member.removed
workspace.updated     workspace.deleted
integration.updated   integration.removed
sso.updated           sso.removed
account.data_exported account.deleted
platform.workspace_entered   platform.workspace_exited
platform.workspace_renamed   platform.workspace_suspended
```

Cross-tenant provider actions (a DecisionOS super-admin entering a customer
workspace to impersonate, or renaming / suspending one) are recorded **under the
target workspace**, not just in internal analytics - so
the customer's own admin can see, in **Settings → Audit log**, exactly when staff
accessed or changed their workspace. This is both a SOC 2 CC6.1/CC6.3 control and
a customer-facing transparency guarantee.

Retention is enforced in-product: the append-only trail is pruned nightly by
`/api/cron/audit-retention`, which deletes rows older than `AUDIT_RETENTION_DAYS`
(default ~18 months). This is the only path that removes audit rows.

Integrity properties that matter for an auditor:

- **Append-only.** The application never `UPDATE`s or `DELETE`s audit rows, and
  there is no route that mutates them - an admin can read the trail but cannot
  rewrite history through the product.
- **Survives deletion.** `AuditLog` has no foreign key to `User` or `Workspace`;
  the actor is denormalized, so erasing an account or workspace does not erase the
  evidence that it happened.
- **Tenant-scoped reads.** An admin only ever sees their own workspace's entries
  (`GET /api/audit`, `require: "admin"`, filtered by `workspaceId`).

## Still the operator's responsibility (organizational, not code)

A SOC 2 report attests to the *operating entity's* controls, so these live
outside the codebase:

- Formal information-security, access-review, incident-response, and
  business-continuity policies, with evidence of operation over the audit period.
- Periodic access reviews and least-privilege enforcement for infrastructure
  (cloud IAM, database, CI/CD), plus MFA on those accounts.
- Backup, restore testing, and a documented RTO/RPO (Availability criterion).
- Vendor risk assessments for each sub-processor.
- Shipping audit rows to tamper-resistant storage (e.g. a WORM bucket or SIEM)
  for the required retention period. (The in-product retention *window* is
  enforced by `/api/cron/audit-retention`; exporting to external immutable
  storage before pruning remains an operator step.)
- Selecting an auditor and completing a Type I (point-in-time) then Type II
  (operating-effectiveness over a period) examination.
