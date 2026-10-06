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

These were fixed in the change that added this page. See `CHANGELOG.md` for
the details.

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

### P0: adoption blockers

1. **Invites people can actually accept.** `POST /api/team` creates the account
   with a random password that is never sent, and there is no reset flow.
   Without SSO, an invitee cannot sign in. Plan:
   - single-use invite tokens (reuse `lib/review-token.ts` signing) emailed via
     `lib/email.ts`;
   - a `/invite/[token]` page that sets a password;
   - "Forgot password" on `/login` using the same token flow;
   - while SMTP is not configured, show the invite link to the admin so they
     can share it themselves.
2. **Public sharing should be opt-in.** `/share/[id]` currently serves any
   workspace-visible decision without login. Plan:
   - a per-decision "Share publicly" toggle that stores a random share token,
     so the URL is not just the decision id;
   - revoke that link from the decision page;
   - a workspace-level setting to disable public sharing entirely.

### P1: core-flow gaps

3. **Action items on the decision page.** Follow-ups live only on the board,
   and its decision picker is capped at 30 decisions with titles cut at 40
   characters. Show a decision's action items on its page and let people add
   them there.
4. **Team management.** Add role changes (`PATCH /api/team/[id]`) and a remove
   button for the existing `DELETE` route on `/team`.
5. **Relations.** Add a remove button (the `DELETE` route exists).
6. **Visibility control in the UI.** The API supports private decisions, but
   the form always sends `workspace`. Add a visibility control to the form and
   the decision page.
7. **Accountable (DRI) and Consulted.** These are captured at creation but
   never shown afterwards. Show them on the decision page and make them
   editable there.
8. **AI drafting UI.** `POST /api/decisions/ai-draft` exists, but nothing
   calls it. Add a "Draft with AI" action on the form, shown only when a key
   is configured.
9. **One definition of "reviews due".** The sidebar counts *your* due reviews,
   while the Reviews page and the "Needs review" filter count the whole
   workspace. Label them separately, or offer a mine/all toggle.
10. **Don't lose drafts.** Add an unsaved-changes guard and a local autosave on
    the new-decision form. Keep the values on the signup form after a server
    error. Keep note and review dialog text when the dialog is dismissed.
11. **Quick capture should respect status.** ⌘K quick capture always creates
    an *approved* decision. Default to proposed, or let the user choose.

### P2: polish and reach

12. **Scale.** Paginate the decisions list, activity, and reviews. Stop loading
    every workspace decision on the decision page just to fill pickers; use
    the search endpoint as a typeahead instead.
13. **Archived decisions.** Hide them from the default decisions list, with a
    "Show archived" toggle, so archiving matches what the confirmation dialog
    promises.
14. **Kanban robustness.** Roll back the optimistic move when the API rejects
    it.
15. **Template placeholders.** Built-in templates insert literal
    `[describe]` text. Render template hints as placeholders, or highlight
    unedited template text in the quality meter.
16. **Import.** Add the reverse of the ADR export: import a folder of
    ADR/MADR Markdown files, or a CSV, so teams can migrate an existing log.
17. **Integrations.** Unfurl GitHub/Linear/Jira links into typed links,
    capture decisions from GitHub PR comments, and add outgoing webhooks for
    decision events.
18. **Agent access.** Expose search and Ask as an MCP server, so coding agents
    can cite past decisions while they work.
19. **Accessibility pass.** Run the Storybook a11y addon in CI, do a full
    keyboard walk-through of the graph and board, and check that status is
    never signalled by color alone.
20. **Internationalization.** Format dates through the user's locale
    consistently; some date inputs and labels currently disagree.

### Contributor experience

- **End-to-end tests.** Add a small Playwright suite (`playwright-core` is
  already a dev dependency) that covers sign-in, logging a decision from a
  template, tagging, and reviewing, and run it in CI against the demo seed.
- **One seed.** `prisma/seed.ts` and `/api/seed` maintain two copies of the
  demo data. Have both call a shared module, as they already do for the
  built-in templates.
- **Offline-friendly setup.** Document what to do when Prisma's engine
  download is blocked, for corporate proxies and air-gapped machines.
