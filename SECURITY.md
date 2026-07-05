# Security Policy

## Supported Versions

DecisionOS is distributed as source you self-host - there are no long-term
release branches. Security fixes land on `main`; run a recent `main` (or a
container image built from it) to stay patched.

| Version | Supported |
| ------- | --------- |
| `main` (latest) | ✅ |
| older commits / forks | ❌ - rebase onto `main` |

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately using GitHub's **[Report a vulnerability](https://github.com/shafaypro/DecisionOS/security/advisories/new)** button (Security → Advisories). This opens a private channel with the maintainer.

Please include: affected version/commit, reproduction steps, impact, and any proof-of-concept.

**What to expect:**
- An acknowledgement within a few days.
- An assessment of severity and a fix or mitigation plan for confirmed issues.
- Coordinated disclosure - we'll agree on timing before any public write-up, and credit you if you'd like.

Since DecisionOS is self-hosted, once a fix is on `main` you are responsible for pulling it into your deployment.

## Automated security scanning

Every push and pull request to `main` (and a weekly scheduled sweep) runs:

| Check | Workflow | What it catches |
| --- | --- | --- |
| **Secret scanning** | `.github/workflows/security.yml` (gitleaks) | Credentials/API keys committed to code or git history. Allowlist for documented placeholders lives in `.gitleaks.toml`. |
| **Dependency review** | `.github/workflows/security.yml` | Pull requests that add dependencies with known high+ vulnerabilities or copyleft (GPL/AGPL) licenses. |
| **Dependency audit** | `.github/workflows/ci.yml` | `npm audit` failing on high/critical advisories in the resolved tree. |
| **Static analysis (SAST)** | `.github/workflows/codeql.yml` (CodeQL, `security-extended`) | Injection, unsafe deserialization, and other code-level vulnerabilities in JS/TS. |

> **CodeQL** and **Dependency review** require GitHub's Dependency Graph +
> Advanced Security (Settings → Code security). Until that is enabled they run
> as **advisory** (`continue-on-error`) and never block a merge. Remove the
> `continue-on-error` lines in their workflows to make them hard gates once GHAS
> is on. **Secret scanning** and **dependency audit** need no GHAS and gate the
> build today.

A gitleaks finding fails the build - never commit a real secret, even temporarily.
Configuration secrets are provided via environment variables (see `.env.example`)
and, in production, a secrets manager; they are never committed.

## Known advisories accepted as not-applicable

Some advisories have no upstream fix and do not affect the shipped application.
These are dismissed in Dependabot with a documented reason rather than patched:

| Advisory | Where | Why it's accepted |
| --- | --- | --- |
| `elliptic` – "uses a cryptographic primitive with a risky implementation" (low) | dev-only, transitive via `@storybook/nextjs` → `node-polyfill-webpack-plugin` → `crypto-browserify` | Storybook **build-time** tooling only. It is never imported by the Next.js app, never in the production bundle, and never in the published Docker image. No `elliptic` release fixes the advisory (it covers all versions), and the latest `@storybook/nextjs` still pulls the same chain, so there is nothing to bump to. `npm audit` classifies it **low**; the CI `npm audit` gate is high+, so it does not block builds. Re-evaluate if Storybook drops the polyfill dependency. |
