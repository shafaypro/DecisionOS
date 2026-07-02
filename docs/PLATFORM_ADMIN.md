# Platform Admin - the provider control plane

DecisionOS is multi-tenant: a **Workspace = one company**, with its own SSO,
Slack install, members, and decisions. Inside a company the highest role is a workspace
**admin**.

The **platform control plane** is the layer *above* the workspace - for **you, the DecisionOS
provider**. A platform **super-admin** can see every company on the instance, drop into any one
of them to manage it, and suspend it. This is purely additive: the per-company
experience is unchanged, and tenant isolation between companies is not weakened.

> **Two distinct layers - don't confuse them:**
>
> | Layer | Who | Scope | Granted by |
> |---|---|---|---|
> | **Workspace** | A company's `admin` | One workspace | An invite from another workspace admin |
> | **Platform** | DecisionOS staff (`superadmin`) | **Every** workspace | The `PLATFORM_ADMIN_EMAILS` env allow-list |
>
> Platform privilege is a **separate axis** from the workspace role. The same person can be a
> workspace admin *and* a platform super-admin, or either alone.

---

## Granting platform access

The **only** way to make someone a platform admin is the `PLATFORM_ADMIN_EMAILS` environment
variable - a comma-separated allow-list of emails. It is read through `src/lib/env.ts` and
evaluated **at login**, then stamped into the session as `platformRole: "superadmin"`.

```bash
PLATFORM_ADMIN_EMAILS="you@decisionos.app,ops@decisionos.app"
```

Why an env var and not a database flag:

- **Cannot be self-granted.** A compromised workspace admin, a rogue member, or a SQL-injection
  bug can't escalate to platform access - there is no DB column to write.
- **Fails closed.** Exactly like `CRON_SECRET`: if the variable is unset or empty, there are
  **no** platform admins. A misconfiguration locks the console rather than opening it.
- **Case-insensitive.** Whitespace and letter-casing around each email are normalized.

A user must **log out and back in** after being added to (or removed from) the list, because the
role is captured into the session cookie at login.

---

## The `/admin` console

Signed in as a platform admin, you get a **Platform** link in the app sidebar and can visit
**`/admin`** - a console with its own shell (dark header, "DecisionOS Platform"), deliberately
distinct from any company view so the two are never confused.

The console lists **every company** on the instance with:

- name + slug
- **status** (`active | suspended`)
- member count and decision count

Non-staff who somehow reach `/admin` are bounced to `/decisions` (enforced in `src/proxy.ts` and
re-checked server-side in the console layout).

---

## Enter a company (impersonation)

Click **Enter** on any company to manage it as an admin. Under the hood this re-issues your
session pointed at the target workspace (`workspaceId = <target>`), so **every existing
workspace-scoped page and route just works** - no separate cross-tenant admin screens to learn.

While you're "entered":

- A persistent **amber banner** ("Viewing &lt;company&gt; as platform admin") makes the
  impersonation unmistakable.
- Click **Exit to console** to return to your own workspace and back to `/admin`.
- Your `platformRole` is carried through the swap (so you keep `/admin` access), and your **home
  workspace** is remembered so Exit always brings you back.
- Anything you create while entered is attributed to **your** user, and the action is recorded in
  the audit log (below).

---

## Suspend / reactivate a company

From a company's row, **Suspend** locks the workspace for its own members - they're redirected to
a `/suspended` notice page on their next request. A platform admin who has **entered** the
workspace keeps access (so you can investigate or fix things while it's suspended).

**Reactivate** flips it back to `active` and members regain access immediately.


## Audit

Every cross-tenant staff action is logged to the first-party analytics event table
(`src/lib/analytics.ts`), tagged with the acting `userId` and the target `workspaceId`:

| Event | When |
|---|---|
| `platform.workspace_entered` | A platform admin enters a company |
| `platform.workspace_suspended` | A company's status is changed (suspend/reactivate) |

---

## Security model

- **Separate authorization axis.** Platform gating lives in its own `authorizePlatform()` /
  `withPlatformApi()` wrapper (`src/lib/platform-authorize.ts`, `src/lib/platform-api-handler.ts`),
  parallel to - and independent of - the workspace `withApi` / `authorizeRole`. Workspace
  authorization is untouched.
- **Tenant isolation is preserved.** The `workspaceWhere()` scoping in `src/lib/tenant.ts` is
  **not** modified. The console's cross-tenant reads are explicit, staff-only code paths; ordinary
  workspace routes still scope by `session.workspaceId` exactly as before.
- **Layered gating.** `/admin*` is gated in the edge proxy (`src/proxy.ts`) and re-checked in the
  console layout; `/api/platform/*` is gated by `withPlatformApi` (401 if unauthenticated, 403 if
  not staff).

---

## Setup

1. **Set the allow-list** and redeploy:
   ```bash
   PLATFORM_ADMIN_EMAILS="you@yourdomain.com"
   ```
2. **Apply the migration** that adds `Workspace.status`:
   ```bash
   npx prisma migrate deploy   # prod (Postgres)
   # local SQLite is derived automatically by `npm run dev`
   ```
3. **Log in** as one of the allow-listed emails → the **Platform** link appears in the sidebar.

---

## API reference

All routes are staff-only (reached through `withPlatformApi`): `401` if unauthenticated, `403`
if the session has no `platformRole`. They are intentionally **not** scoped to a single
workspace.

| Method | Route | Body | Description |
|---|---|---|---|
| `GET` | `/api/platform/workspaces` | - | List every workspace with status, member/decision counts |
| `POST` | `/api/platform/workspaces/:id/enter` | - | Enter a company (re-issues the session at that workspace) |
| `POST` | `/api/platform/exit` | - | Stop impersonating; return to your home workspace |
| `PATCH` | `/api/platform/workspaces/:id` | `{ status?, name?, slug? }` | Suspend/reactivate (`status`) or rename |

---

## Session payload (reference)

Platform fields are **optional** - present only for staff:

```ts
{
  userId: string
  workspaceId: string                 // the workspace currently in context (swapped while "entered")
  role: "admin" | "member" | "viewer"
  email: string
  name: string
  platformRole?: "superadmin"         // present only for platform staff
  platformHomeWorkspaceId?: string    // the admin's own workspace - the way back from impersonation
}
```

---

## Out of scope (future)

- DB-managed tiered staff roles (e.g. read-only "support" vs "superadmin") and an in-app staff
  manager - the env allow-list covers today's needs.
- Provider-only signup (disable public `/signup` behind a flag).
- Cross-tenant aggregate usage dashboards and a dedicated `PlatformAuditLog` table
  for compliance-grade retention.
