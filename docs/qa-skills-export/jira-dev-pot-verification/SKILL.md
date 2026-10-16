---
name: jira-dev-pot-verification
description: Verify a developer's Proof of Testing (POT) on a Jira ticket against that ticket's Acceptance Criteria, and report which ACs are Covered, Partially covered, Not covered, or Cannot be verified from the evidence. Read-only — never marks a ticket passed or posts a pass on the dev's behalf.
---

# Jira Dev POT Verification

Check the **Proof of Testing (POT)** a developer attached to a Jira ticket against that
ticket's **Acceptance Criteria (AC)**, and produce an honest coverage report: for every
AC, does the submitted evidence actually demonstrate it?

This is a QA review aid, not an approval step. It helps the tester decide where to focus;
it does not replace the tester's own judgment and never signs off on the dev's behalf.

## Trigger
Use for requests such as:
- `Verify the dev's Proof of Testing for BLR-1234`
- `Did the dev cover the acceptance criteria in their POT?`
- `Check BLR-1234's proof of testing against the ACs`

## Inputs
1. **Acceptance Criteria** — read from the ticket's dedicated AC field (e.g.
   `customfield_10183`) AND the Description/Scope of Work. Use the ACs exactly as written;
   do not invent or reword requirements.
2. **Proof of Testing** — the developer's comment(s) and their attachments: text
   descriptions, screenshots (images), and screen recordings (video). Read the POT
   comment body and inspect each attachment that can be inspected.

## Fetch only the fields you need (keep context lean)
Do NOT fetch the ticket with `fields: ["*all"]` — it pulls every custom field and bloats
context (a single large ticket can be 15–20k tokens on its own). Request only:

```
fields: ["summary", "description", "customfield_10183", "customfield_10184",
         "assignee", "attachment", "comment"]
```

- `customfield_10183` = Acceptance Criteria, `customfield_10184` = assigned developer(s).
- This typically halves the ticket payload vs `*all`.
- Only download the images referenced in the **developer's POT comment**, not every
  attachment on the ticket. Skip videos (they can't be inspected — see below), so they
  cost no tokens.

## Procedure
1. **Retrieve the ticket** via the Atlassian MCP (full description + AC field + comments +
   attachments). Never work from the title alone.
2. **Extract the ACs** as a discrete, numbered list.
3. **Locate the POT** — identify which comment(s) are the developer's Proof of Testing and
   enumerate the evidence items (each screenshot, each recording, each written claim),
   noting the author and which attachment maps to which stated scenario.
4. **Map evidence → AC** — for each AC, find the specific evidence that demonstrates it.
   Match on the actual behavior shown, not just a filename or a label the dev wrote.
5. **Classify each AC** (see statuses below).
6. **Report** the coverage table + a short summary of gaps. Do not post anything to Jira or
   Qase unless the user explicitly asks.

## Downloading attachments to inspect them (images)
Jira attachment `content` URLs are **auth-protected** — a plain unauthenticated request
returns `403 "You do not have permission"`. To actually inspect a dev's screenshots,
download them with **Basic auth** using the Jira API token:

- Credentials live in `.env`: `JIRA_EMAIL` and `JIRA_API_TOKEN`.
- The `content` endpoint returns an HTTP 303 redirect to a pre-signed CDN URL. `curl` with
  the token can choke on redirect + special chars in the token, so prefer a small Python
  downloader (urllib follows the redirect; the signed CDN URL needs no auth header). A
  reusable script lives at `.explore-tmp/dl-attachments.py` — adapt the attachment IDs.
- Save images under `.explore-tmp/pot-<TICKET>/` and read them, then clean up afterward.
- The API token is created once at
  https://id.atlassian.com/manage-profile/security/api-tokens and reused for every run —
  it is not consumed per-verification.
- If `.env` has no token, do NOT fail silently: tell the user the images are auth-protected
  and either ask for the token or ask them to drag the screenshots into chat, and mark the
  affected ACs `⚠ Needs manual review` meanwhile.

## Evidence limitations (BE HONEST — this is the whole point)
- **Video / screen recordings (`.mov`, `.mp4`, etc.): cannot be watched.** Do NOT claim an
  AC is covered because a recording's filename or the dev's caption says so. Mark it
  `⚠ Needs manual review (video)` and tell the user which recording to watch for which AC.
  Do not download videos — they can't be inspected and only waste bandwidth/context.
- **Images/screenshots:** download (see above) and inspect them. Only mark an AC `Covered`
  if the screenshot actually shows the required state/behavior/values. If the image is
  ambiguous, truncated, or shows a different scenario, mark `Partial` or `Cannot verify`
  and say why.
- **Text-only claims** ("tested, works") with no supporting artifact are NOT evidence —
  mark the AC `Not covered` (no proof) or `Cannot verify`, never `Covered`.
- When in doubt, downgrade. A false "Covered" is worse than an honest "Cannot verify."

## Status values
- **✅ Covered** — evidence that can be inspected clearly demonstrates the AC.
- **🟡 Partial** — some but not all of the AC is demonstrated (e.g. the happy path is shown
  but a required case/variant isn't), or evidence is weak/ambiguous.
- **❌ Not covered** — no evidence maps to this AC, or only an unsupported text claim.
- **⚠ Needs manual review** — evidence exists but can't be verified here (video recording,
  external link, unreadable artifact). Name the specific item to review.

## Output format
Report in chat as a table, one row per AC, followed by a short gap summary:

```
## POT Verification — <TICKET-KEY>
Dev: <POT author>   |   ACs: <n>   |   POT items: <n images, n videos, n text claims>

| # | Acceptance Criteria | Evidence found | Status |
|---|---------------------|----------------|--------|
| 1 | <AC text, concise>  | <which screenshot/recording/claim, what it shows> | ✅ Covered |
| 2 | ...                 | Screen_recording_x.mp4 | ⚠ Needs manual review (video) |
| 3 | ...                 | none | ❌ Not covered |

### Summary
- Covered: <list AC #s>
- Partial: <list + what's missing>
- Not covered: <list>
- Needs manual review: <list + which file to watch>
- Recommendation: <e.g. "ACs 1–3 look covered by screenshots; AC 4 needs you to watch
  Screen_recording_2.mp4; AC 5 has no evidence — ask the dev.">
```

## Rules
- **Read-only by default.** Never transition the ticket, never mark Test Passed, never post
  a verification comment unless the user explicitly requests it. If asked to post, show the
  draft first.
- **Never fabricate coverage.** Do not infer that an AC is met from a filename, a caption,
  or the dev's assertion alone — only from evidence you actually inspected.
- **Attribute honestly.** If the Atlassian MCP fails or an attachment can't be loaded, say
  so plainly and mark the affected ACs `⚠ Needs manual review` rather than guessing.
- Use the ACs as written; if the AC field is empty, derive from the Description/Scope of
  Work and state that you did so.
