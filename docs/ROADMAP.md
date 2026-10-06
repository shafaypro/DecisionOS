# Product evaluation & roadmap

This page records where DecisionOS stands as a product, what has been fixed
recently, and what comes next, in priority order. It is the source for
`good first issue` and `help wanted` issues. If you want to pick something up,
open an issue that references the item so nobody duplicates the work.

The evaluation comes from running the app against the demo seed on desktop and
on a 390px phone, plus a code audit of every page under `src/app/(app)` and
the API routes they call.

---

## Where the product is strong

- **The core record is right.** Problem, solution, rationale, alternatives,
  assumptions, and risks, with a quality meter that pushes people toward the
  fields that matter later: rationale and alternatives.
- **Decisions get revisited.** Review dates, overdue nudges (email, Slack DMs,
  weekly digest), outcome ratings, and decision health all push people to
  check whether a decision actually worked. Most ADR tools stop at "write it
  down".
- **Retrieval is good.** The search query language, Ask with cited answers
  (which also works with no AI key), the decision graph, the risk register,
  and portable exports (CSV, JSON, ADR Markdown) together make the log useful
  after the fact.
- **It is easy to self-host.** It runs on SQLite with zero setup locally and
  on Postgres in production, with Docker, Kubernetes, and cloud runbooks,
  OpenAPI at `/api/openapi`, and no third-party auth or tracking.

## What the evaluation found (and fixed)

These were fixed in the change that added this page; later fixes are under
"Shipped since the evaluation" below. See `CHANGELOG.md` for the details.

| Area | Problem | Status |
|---|---|---|
| Data | The web form never sent category, impact, or summary, so everything became "Other / Medium". | Fixed: these are on the form and editable inline |
| Data | Status values drifted: `draft` was not a listed status, and the seeds wrote `decided`, `validated`, and `under_review`. | Fixed: one vocabulary, enforced, with a migration |
| Security | Private decisions were visible in the list, detail, reviews, graph, board, and My work pages. | Fixed |
| Feature | Templates and tags existed in the database and API but could not be used from the UI. | Fixed: template chips on the form, tag picker on the decision page |
| Feature | A reviewed decision never came due again, even after its review date moved. | Fixed |
| UX | Dialogs stole focus on every keystroke, and the count badges were invisible. | Fixed |
| UX | Failed archives, deletes, and inline saves were silent or threw away what you typed. | Fixed |
| UX | Board, My work, Tags, and Templates had no navigation entry. Every browser tab had the same title. | Fixed |
| Mobile | The menu button covered page titles, and the hidden drawer was still tab-reachable. | Fixed |

---

## Roadmap

Priorities: **P0** blocks a real team from adopting the product. **P1** is a
visible gap in a core flow. **P2** is polish or reach.

### Shipped since the evaluation

| Was | Now |
|---|---|
| **P0** Invited users couldn't sign in (random password, no reset) | Single-use set-password links by email, or shown to the admin when email isn't configured; "Forgot password"; invitees sign straight in |
| **P0** Every workspace-visible decision was public at `/share/<id>` | Opt-in links at `/share/<random-token>`, revocable from the decision's Share panel; an admin switch turns them off (and revokes them) workspace-wide |
| **P1** Action items lived only on the board | Listed, ticked off, and added on the decision page; the board's picker shows every decision |
| **P1** No role changes or removal in the UI | Role picker and remove button on /team; the last admin is protected; demotions apply on the next request |
| **P1** Relations couldn't be removed | Remove button for the relation's creator or an admin |
| **P1** Private decisions couldn't be created from the UI | Private option on the form; author can switch visibility on the decision page |
| **P1** Accountable / Consulted captured but never shown | Shown and editable on the decision page |
| **P1** AI drafting endpoint had no UI | "Suggest framing with AI" fills empty problem / alternatives / assumptions / risks - never the rationale |
| **P1** Quick capture always created *approved* decisions | Proposed by default, with an "already decided" checkbox |
| **P1** Signup lost the form on a server error | Values are kept |
| **P2** Archived decisions cluttered the default list | Hidden by default; "Show archived (N)" or any status filter brings them back |
| **P2** Kanban moves failed silently | Roll back with an error toast |

Found and fixed along the way: about a dozen decision API routes (notes,
reviews, links, relations, versions, watch, archive, tags, action items, and
the decision update itself) checked only the workspace, so a member who knew a
private decision's id could read or edit it. They now go through
`visibleDecision()`. Separately, `.env.example` shipped active placeholder
SMTP settings, which stalled every email-sending request in a fresh setup.

### Still open

**P1: core-flow gaps**

1. **One definition of "reviews due".** The sidebar counts *your* due reviews,
   while the Reviews page and the "Needs review" filter count the whole
   workspace. Label them separately, or offer a mine/all toggle.
2. **Don't lose drafts.** Add an unsaved-changes guard and a local autosave on
   the new-decision form. Keep note and review dialog text when the dialog is
   dismissed.
3. **Multiple workspaces per person.** Sign-in always opens a person's first
   membership. Someone invited into a second workspace has no way to switch
   to it. Add a workspace switcher.

**P2: polish and reach**

4. **Scale.** Paginate the decisions list, activity, and reviews. Stop loading
   every workspace decision on the decision page just to fill pickers; use the
   search endpoint as a typeahead instead.
5. **Template placeholders.** Built-in templates insert literal `[describe]`
   text. Render template hints as placeholders, or highlight unedited template
   text in the quality meter.
6. **Import.** Add the reverse of the ADR export: import a folder of ADR/MADR
   Markdown files, or a CSV, so teams can migrate an existing log.
7. **Integrations.** Unfurl GitHub/Linear/Jira links into typed links, capture
   decisions from GitHub PR comments, and add outgoing webhooks for decision
   events.
8. **Agent access.** Expose search and Ask as an MCP server, so coding agents
   can cite past decisions while they work.
9. **Accessibility pass.** Run the Storybook a11y addon in CI, do a full
   keyboard walk-through of the graph and board, and check that status is
   never signalled by color alone.
10. **Internationalization.** Format dates through the user's locale
    consistently; some date inputs and labels currently disagree.
11. **Dev-only audit findings.** The `braces` advisory covers every published
    version and reaches us only through ESLint's and Storybook's file
    watchers. CI reports it without blocking; restore the strict all-high gate
    once upstream ships a fix.

### Contributor experience

- **End-to-end tests.** Add a small Playwright suite (`playwright-core` is
  already a dev dependency) that covers sign-in, logging a decision from a
  template, tagging, and reviewing, and run it in CI against the demo seed.
- **One seed.** `prisma/seed.ts` and `/api/seed` maintain two copies of the
  demo data. Have both call a shared module, as they already do for the
  built-in templates.
- **Offline-friendly setup.** Document what to do when Prisma's engine
  download is blocked, for corporate proxies and air-gapped machines.
