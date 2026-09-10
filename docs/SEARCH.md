# Search syntax

The search box on **Decisions** (and the `q` parameter of `GET /api/decisions/search`)
accepts more than free text. Filters and text can be mixed freely, in any order:

```
status:approved impact:high owner:me "primary database"
category:engineering -status:archived after:30d
```

Every filter is optional; a query with no filters behaves exactly as plain search
always did.

## Rules

| Form | Meaning |
|---|---|
| `field:value` | Constrain a field. |
| `field:a field:b` | Repeating a field **ORs** the values - either matches. |
| `-field:value` | Exclude. Repeated exclusions are ANDed. |
| `"quoted phrase"` | Free text kept as a single phrase. |
| bare words | Free text, matched against title, summary, problem, solution, and rationale. |

Different fields are **ANDed**: `status:approved impact:high` means both.

## Fields

| Field | Values | Example |
|---|---|---|
| `status` | `draft`, `proposed`, `in_review`, `approved`, `reversed`, `superseded`, `archived` | `status:approved` |
| `category` | `product`, `engineering`, `business`, `hiring`, `finance`, `marketing`, `strategy`, `operations`, `other` | `category:hiring` |
| `impact` | `low`, `medium`, `high` | `impact:high` |
| `outcome` | `unknown`, `successful`, `mixed`, `unsuccessful` | `outcome:unsuccessful` |
| `owner` | A user id, or `me` | `owner:me` |
| `tag` | A workspace tag name | `tag:infra` |
| `health` | `healthy`, `review-due-soon`, `review-overdue`, `stale`, `orphaned`, `superseded-unreviewed`, `superseded`, `archived` | `health:stale` |
| `before` / `after` | A date (`2025-01-15`) or a relative window (`30d`, `2w`, `6m`, `1y`), matched against last-updated | `after:30d` |
| `is` | `mine`, `unowned`, `overdue`, `draft`, `reviewed`, `private` | `is:overdue` |

Values are case-insensitive, and spaces or hyphens may be written as underscores
(`status:In Review`, `status:in-review`, and `status:in_review` are the same).

## Shorthands

`is:` covers the questions people ask most often:

| Shorthand | Equivalent to |
|---|---|
| `is:mine` | You own it **or** you created it |
| `is:unowned` | No owner assigned |
| `is:overdue` | Review date has passed with no review submitted |
| `is:draft` | Status is `draft` or `proposed` |
| `is:reviewed` | A review has been recorded |
| `is:private` | Visibility is not `workspace` |

## Recipes

```
is:overdue impact:high              # the risky things nobody has re-checked
owner:me -status:archived           # my live decisions
health:stale category:engineering   # engineering decisions going quiet
tag:security after:90d              # recent security-tagged activity
outcome:unsuccessful                # what didn't work, for a retro
```

## Behaviour notes

- **Nothing fails hard.** An unknown filter (`bogus:x`) or an unparseable date is
  searched as plain text or dropped, and the page shows a note explaining what it
  did. A typo never returns a silent empty list.
- **Tenancy is never affected.** Filters are ANDed *on top of* workspace scoping
  and per-decision visibility, so search can't surface another member's private
  decision.
- **`health:` is applied after fetching**, because health is derived rather than
  stored. Everything else is pushed down to the database.
