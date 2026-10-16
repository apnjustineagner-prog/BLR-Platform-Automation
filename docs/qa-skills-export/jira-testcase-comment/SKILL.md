---
name: jira-testcase-comment
description: Format the finalized Qase test cases as an ADF table comment on the Jira ticket. This is step 9 of the jira-to-qase pipeline; it mirrors Qase and never regenerates cases from the ticket.
---

# Jira Test Case Comment

Post the **finalized Qase test cases** back onto the source Jira ticket as ADF table comments. This skill is the **final formatting step (step 9) of the `jira-to-qase` pipeline** — it does not run on its own and does not generate test cases. The pipeline calls it only **after** the Qase create/update/remove changes have succeeded and the final Qase set has been validated.

Source of truth is **Qase, not the ticket.** Use the validated Qase case titles and IDs. Never regenerate cases from the ticket or add scenarios that are not in Qase.

## Gate
Only post after the Qase changes are confirmed successful and the final set has been validated. If any Qase operation failed, do NOT post — report the failure instead (see `jira-to-qase` Important Rule).

## Comment Layout
- **Group by test behavior — one ADF table per group**, each under its own `heading` (level 3), in this order:
  1. **Valid Tests**
  2. **Negative Tests**
  3. **Edge Cases**
  Omit any group that has no cases. Classify each case by behavior: happy-path/valid → Valid; error/validation/negative → Negative; boundary/edge → Edge.
- **Four columns per table: `Test Case Title` | `Test Data` | `Remark` | `Status`.**
  - **Column 1 (`Test Case Title`):** first paragraph = the case title in **bold** (optionally prefixed with its Qase ID); second paragraph = AC coverage, e.g. `AC: 1, 3` (use `N/A` if the case maps to no specific AC). Do NOT put Preconditions/Steps/Expected Result in this column.
  - **Column 2 (`Test Data`):** data needed to run the scenario (one item per line via `hardBreak`, or `N/A`). Safe representative values/placeholders.
  - **Column 3 (`Remark`):** single empty paragraph (blank for tester notes/evidence).
  - **Column 4 (`Status`):** a `taskList` with two prefilled `taskItem` checkboxes — `Test Passed` (green) and `Test Failed` (red), both unchecked (`state: "TODO"`).

## ADF Rules (IMPORTANT)
Jira comment tables must be posted using **ADF (`contentFormat: adf`)**, not markdown or wiki markup.

- Do NOT use markdown pipe tables or wiki `||`/`|` syntax with `contentFormat: markdown`. The markdown converter escapes line breaks (`\\` → `\\\\`) and mangles multi-line cells, so the table fails to render.
- Build a real ADF `table` node per group with four columns:
  - Header row: four `tableHeader` cells — `Test Case Title`, `Test Data`, `Remark`, `Status`.
  - One `tableRow` per test case.
- Apply color to Status labels via a `textColor` mark: green `#216e4e` (or `#00875a`) for Test Passed, red `#ae2e24` (or `#de350b`) for Test Failed.
- Give each `taskList`/`taskItem` a unique `localId` per row (e.g. `status-<id>`, `<id>-pass`, `<id>-fail`) so checkboxes render independently.
- Pass the ADF document as the JSON string body with `contentFormat: "adf"`.

### Column 1 cell shape
```json
{ "type": "tableCell", "content": [
  { "type": "paragraph", "content": [ { "type": "text", "text": "<QASE-ID> <Expected Behavior> when <Condition>", "marks": [ { "type": "strong" } ] } ] },
  { "type": "paragraph", "content": [ { "type": "text", "text": "AC: 1, 3" } ] }
] }
```

### Status cell shape
```json
{ "type": "tableCell", "content": [
  { "type": "taskList", "attrs": { "localId": "status-<id>" }, "content": [
    { "type": "taskItem", "attrs": { "localId": "<id>-pass", "state": "TODO" }, "content": [ { "type": "text", "text": "Test Passed", "marks": [ { "type": "textColor", "attrs": { "color": "#216e4e" } } ] } ] },
    { "type": "taskItem", "attrs": { "localId": "<id>-fail", "state": "TODO" }, "content": [ { "type": "text", "text": "Test Failed", "marks": [ { "type": "textColor", "attrs": { "color": "#ae2e24" } } ] } ] }
  ] }
] }
```

### Minimal group table shape (one behavior group)
```json
{
  "type": "doc",
  "version": 1,
  "content": [
    { "type": "heading", "attrs": { "level": 3 }, "content": [ { "type": "text", "text": "Valid Tests" } ] },
    { "type": "table", "attrs": { "isNumberColumnEnabled": false, "layout": "default" },
      "content": [
        { "type": "tableRow", "content": [
          { "type": "tableHeader", "content": [ { "type": "paragraph", "content": [ { "type": "text", "text": "Test Case Title", "marks": [ { "type": "strong" } ] } ] } ] },
          { "type": "tableHeader", "content": [ { "type": "paragraph", "content": [ { "type": "text", "text": "Test Data", "marks": [ { "type": "strong" } ] } ] } ] },
          { "type": "tableHeader", "content": [ { "type": "paragraph", "content": [ { "type": "text", "text": "Remark", "marks": [ { "type": "strong" } ] } ] } ] },
          { "type": "tableHeader", "content": [ { "type": "paragraph", "content": [ { "type": "text", "text": "Status", "marks": [ { "type": "strong" } ] } ] } ] }
        ] }
      ]
    }
  ]
}
```
Append one `tableRow` per Qase case (Column 1 + Test Data + empty Remark + Status), and repeat the heading + table block for **Negative Tests** and **Edge Cases** as needed.

## Editing vs New Comment
- If a prior test-case comment exists on the ticket, update it in place via `commentId` rather than stacking duplicates.
- Create a fresh comment only when the user wants a separate/new entry.

## Tool Failure
If the Atlassian MCP fails, state the specific issue briefly, never fabricate content or a success status, and ask only for the minimum info needed to continue.
