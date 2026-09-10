# API and data portability

DecisionOS is self-hosted, so the decision log is yours: everything the UI does
goes through an HTTP API you can script, and the whole log can be exported in
three formats without screen-scraping.

## OpenAPI

Every deployment serves a machine-readable description of its own API:

```bash
curl https://your-instance.example.com/api/openapi > decisionos.json
```

The document is OpenAPI 3.1, unauthenticated (it describes shapes, not data), and
its `servers[0].url` follows the deployment - so it can be pointed straight at
Swagger UI, Postman, or a client generator:

```bash
npx @redocly/cli preview-docs https://your-instance.example.com/api/openapi
```

## Authentication

All data endpoints authenticate with the session cookie issued by
`POST /api/auth/login` (or by SSO). A script can log in once and reuse the jar:

```bash
curl -c jar.txt -X POST https://your-instance.example.com/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@acme.demo","password":"password123"}'

curl -b jar.txt 'https://your-instance.example.com/api/decisions/search?q=status:approved'
```

Every request is re-checked against live workspace membership and workspace
status, so revoking a member's access takes effect immediately - a still-valid
cookie is not enough.

## Export formats

`GET /api/decisions/export?format=…` returns only what the caller may see
(workspace-visible decisions plus their own private ones).

| Format | Content type | Use it for |
|---|---|---|
| `csv` (default) | `text/csv` | Spreadsheets and BI tools. 23 columns. |
| `json` | `application/json` | Backup and migration. Versioned envelope. |
| `md` | `text/markdown` | One Markdown bundle with a table of contents. |

A single decision can also be exported on its own, as an ADR-shaped Markdown file
with YAML front matter:

```bash
curl -b jar.txt -OJ https://your-instance.example.com/api/decisions/<id>/markdown
```

The layout follows the common ADR convention (context → decision → consequences),
so exported files drop straight into an existing `docs/adr` directory.

### JSON envelope

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-03-01T12:00:00.000Z",
  "workspace": { "id": "…", "name": "Acme", "slug": "acme" },
  "count": 128,
  "decisions": [ { "id": "…", "title": "…", "tags": ["infra"], "reviews": [ … ] } ]
}
```

`schemaVersion` is bumped whenever the shape changes incompatibly, so a backup
taken today stays readable.

## Trends

`GET /api/analytics/trends?months=12` returns the same numbers the Analytics page
renders - monthly throughput, review compliance, cycle times, momentum against
the prior window, and the record-quality roll-up - so they can be graphed
elsewhere or alerted on:

```bash
curl -b jar.txt 'https://your-instance.example.com/api/analytics/trends?months=6' | jq '.cycle'
```

## Search

`GET /api/decisions/search?q=…` accepts the full [search syntax](SEARCH.md) and
returns the ranked matches, a human-readable interpretation of the query, and any
parser warnings:

```json
{
  "decisions": [ … ],
  "total": 7,
  "describe": "“auth0” · status: approved",
  "warnings": []
}
```

## Rate limits

Exports, searches, and mutations are rate limited per user and workspace. A
limited response is `429` with the window in the response headers - back off and
retry rather than looping.
