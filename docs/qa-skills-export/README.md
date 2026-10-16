# QA Kiro Skills — Export Pack

These are the Kiro **skills** used to turn Jira tickets into test cases and post
them back to Jira (comment or the ticket's **Test Cases** field). Share this
folder with any QA who uses Kiro; they install the skills into their own
`~/.kiro/skills/` directory.

## What's in here

| File | Skill | What it does |
|---|---|---|
| `jira-to-qase/SKILL.md` | `jira-to-qase` | Full pipeline: read a Jira ticket → formulate coverage → reconcile against existing Qase cases (KEEP/UPDATE/REMOVE/ADD/MOVE) → QA approval → apply in Qase → post the finalized set back to Jira. |
| `jira-testcase-comment/SKILL.md` | `jira-testcase-comment` | Formats the finalized cases as the 4-column ADF table (Test Case Title / Test Data / Remark / Status with Pass/Fail checkboxes), grouped Valid / Negative / Edge. Used both for Jira **comments** and the Jira **Test Cases** field. |
| `jira-dev-pot-verification/SKILL.md` | `jira-dev-pot-verification` | Read-only: verifies a developer's Proof of Testing on a ticket against its Acceptance Criteria and reports Covered / Partial / Not covered / Cannot verify. |

## Install (per QA)

1. Copy each skill folder into your Kiro skills directory:
   ```
   cp -R jira-to-qase            ~/.kiro/skills/
   cp -R jira-testcase-comment   ~/.kiro/skills/
   cp -R jira-dev-pot-verification ~/.kiro/skills/
   ```
2. Restart / reload Kiro so it picks up the new skills.
3. Make sure the **Atlassian** and **Qase** MCP servers are configured in your
   `~/.kiro/settings/mcp.json` (the skills call these). Qase is only needed for
   the `jira-to-qase` pipeline; the comment/field formatting and POT
   verification only need Atlassian.

## Dependencies NOT included here

The `jira-to-qase` skill references two global steering docs that are not part
of this pack (they live in the author's global steering, not the workspace):

- `qa-test-case-convention.md` — how cases are written (title form
  `<Expected Behavior> when <Condition>`, medium granularity, one expected
  result, etc.).
- `qase-suite-organization.md` — action-based flat sub-suites
  (Create / View / Update / Delete / Status).

If your Kiro setup doesn't already have these, the skills still run but won't
enforce those conventions automatically — ask the author (Justine) to share
them, or follow the inline summaries in `jira-to-qase/SKILL.md`.

## Jira → Qase project mapping (from the pipeline skill)

```
TLP → TLPE    BLR → BLR    DZ → DIZ
MOB → EWS     WARP → WARP  ES → ES
```

## Practical notes learned in use

- **Jira "Test Cases" field** (`customfield_10436` on MOB) renders ADF even
  though its metadata type is `textarea`. Write it with `contentFormat: adf`
  and a real `table` node — a plain string renders as flat text.
- **Comment bodies echo back as markdown** in the API response even when posted
  as ADF; that's just the response view. The stored comment is ADF and renders
  the table/checkboxes natively.
- **Qase token scope matters**: the pipeline can only reach projects the
  configured Qase API token can see. If the mapped project isn't accessible,
  confirm the destination with the user instead of guessing.
