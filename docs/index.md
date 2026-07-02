# DecisionOS

<img src="assets/logo.svg" alt="DecisionOS logo" width="88"/>

**The open-source, self-hostable system of record for team decisions.**

Capture what was decided, why, who decided it, the alternatives considered, and
the assumptions and risks. Then close the loop with scheduled outcome reviews so
your team learns whether decisions actually worked. MIT-licensed, no paid plans,
no limits.

[Get started](SETUP.md){ .md-button .md-button--primary }
[View on GitHub](https://github.com/shafaypro/DecisionOS){ .md-button }

## What it does

- **Structured capture** decision, rationale, alternatives, assumptions, risks.
- **Slack-native** log a decision from any channel in seconds.
- **Reviews that close the loop** scheduled reminders and one-click outcomes.
- **Search and a decision graph** find the "why" and see how decisions relate.
- **Enterprise-grade** OIDC SSO, an immutable audit trail, and GDPR data-subject flows.

## Explore the docs

| Section | What it covers |
|---|---|
| [Setup](SETUP.md) | From a fresh clone to production: Slack, SSO, email, cron |
| [Architecture](architecture/README.md) | The code architecture and layer model |
| [Deployment](deployment/README.md) | Compare targets and ship it (Compose, EC2, GCP, ECS, K8s) |
| [GDPR](compliance/GDPR.md) / [SOC 2](compliance/SOC2.md) | Data protection and control mapping |
| [Platform admin](PLATFORM_ADMIN.md) | The cross-tenant provider console |

## Run it locally

```bash
npm install
npm run dev                 # http://localhost:3001
curl http://localhost:3001/api/seed   # load demo data (in another terminal)
```

Sign in with `admin@acme.demo` / `password123`. See [Setup](SETUP.md) for the full guide.
