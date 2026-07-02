# Documentation

The map of DecisionOS docs. Start here.

## Getting started

| Doc | What it covers |
|---|---|
| [Project README](../README.md) | Overview, features, data model, REST API, local quickstart |
| [SETUP.md](SETUP.md) | Full setup: Slack bot, OIDC SSO, email, cron |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Local environment, conventions, how to open a PR |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | Community standards (Contributor Covenant 2.1) |
| [SECURITY.md](../SECURITY.md) | How to report a vulnerability + automated scanning |

## Architecture

| Doc | What it covers |
|---|---|
| [deployment/ARCHITECTURE.md](deployment/ARCHITECTURE.md) | The whole running system in one diagram + guide |
| [architecture/README.md](architecture/README.md) | Code architecture overview and the layer model |
| [architecture/](architecture/) | Per-layer detail: frontend, API, business logic, data |

## Deployment and operations

| Doc | What it covers |
|---|---|
| [deployment/README.md](deployment/README.md) | Compare the deploy targets (Compose, EC2, GCP, ECS, K8s) |
| [deployment/AWS_EC2_DEPLOYMENT_RUNBOOK.md](deployment/AWS_EC2_DEPLOYMENT_RUNBOOK.md) | Self-host on a single EC2, step by step |
| [deployment/GCP.md](deployment/GCP.md) | Alternative: Google Cloud free-tier walkthrough |

CI/CD runs on **GitHub Actions**: [`ci.yml`](../.github/workflows/ci.yml) gates every PR (type-check, lint, smoke + integration tests, build) and [`release-images.yml`](../.github/workflows/release-images.yml) publishes container images to GHCR on push to `main`.

## Features and operations

| Doc | What it covers |
|---|---|
| [PLATFORM_ADMIN.md](PLATFORM_ADMIN.md) | The cross-tenant `/admin` provider console |
| [compliance/GDPR.md](compliance/GDPR.md) | Data processing records and how data-subject rights work |
| [compliance/SOC2.md](compliance/SOC2.md) | SOC 1 / SOC 2 control mapping, incl. the security audit trail |

## Internal (planning, history)

Working notes and historical artifacts, not part of the user-facing docs:

- [internal/PRODUCTION_READINESS.md](internal/PRODUCTION_READINESS.md), [internal/ROADMAP.md](internal/ROADMAP.md), [internal/STARTUP_PLAN.md](internal/STARTUP_PLAN.md), [internal/PROGRESS.md](internal/PROGRESS.md)
- [internal/AUDIT_REPORT.md](internal/AUDIT_REPORT.md) - a point-in-time audit
- [internal/design-plans/](internal/design-plans/) - historical UI/feature implementation plans
