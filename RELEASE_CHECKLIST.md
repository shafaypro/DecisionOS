# Release Checklist

A pre-release readiness record for DecisionOS. This documents the verification
run for the initial public release (`0.1.0`) and serves as the template for
future releases. Copy the checklist, tick each item, and note the results.

## Verification results (0.1.0, 2026-07-02)

| Check | Result |
| --- | --- |
| Lint (`npm run lint`) | Clean, 0 problems |
| Smoke tests (`npm run test:smoke`) | 129 passed, 0 failed |
| Secrets in tree/history | None (history scrubbed and squashed) |
| Governance files present | LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue/PR templates |
| Type check (`tsc`) | CI-gated (requires generated Prisma client) |
| Production build (`next build`) | CI-gated |
| Integration tests | CI-gated |
| npm advisories | 6 low, 0 moderate, 0 high, 0 critical (see below) |

> Type check, build, and integration tests run in GitHub Actions rather than
> locally: they need the generated Prisma client, and the engine download is not
> reachable from every environment. CI is the source of truth for those gates.

## Known advisories (accepted)

`npm audit` reports **6 low-severity** advisories, all from a single upstream
issue and all dev-only:

```
@storybook/nextjs            (dev dependency)
  node-polyfill-webpack-plugin
    crypto-browserify
      browserify-sign  -> elliptic
      create-ecdh      -> elliptic
```

- **Advisory:** "Elliptic Uses a Cryptographic Primitive with a Risky
  Implementation" (low severity), affecting `elliptic <= 6.6.1`.
- **Status:** No patched release exists yet. The advisory range covers every
  published version including the latest (`6.6.1`), so neither `npm audit fix`
  nor a version `override` can resolve it.
- **Exposure:** `elliptic` is pulled in only through `@storybook/nextjs`, a
  **development** dependency used for building the component library. It is never
  bundled into the production application, and the affected code path (browser
  crypto polyfills) is not exercised by DecisionOS.
- **Decision:** Accepted. Re-evaluate when an upstream fix ships, or when
  Storybook drops the `node-polyfill-webpack-plugin` chain. Do not run
  `npm audit fix --force`, which would downgrade/break Storybook without
  clearing the advisory.

## Checklist for future releases

- [ ] `npm run lint` is clean
- [ ] `npm run test:smoke` passes
- [ ] CI is green on `main` (type check, build, integration, CodeQL, security)
- [ ] `npm audit` reviewed; any new moderate+ advisory triaged or fixed
- [ ] No secrets, credentials, or internal hostnames in the tree
- [ ] `CHANGELOG.md` has a dated entry for the new version
- [ ] Version bumped in `package.json`
- [ ] Tag created (`vX.Y.Z`) and GitHub release published
- [ ] Docs site builds (`mkdocs build`) and reflects any new features
