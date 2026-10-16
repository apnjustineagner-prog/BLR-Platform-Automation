---
name: jira-to-qase
description: Generate test cases from Jira, reconcile against existing Qase cases (KEEP/UPDATE/REMOVE/ADD), review with the user, apply approved changes in Qase, then comment the finalized Qase set back to the Jira ticket.
---

# Jira to Qase

Apply global `qa-test-case-convention.md` for how test cases are formulated (title, granularity, coverage, structure). This skill owns the full pipeline: **Jira → Qase → Jira comment**.

## Trigger
Use for requests such as:
- `Please create test cases for this ticket: <Jira link>`
- `Create test cases for TLP-1234.`
- `Create test cases for TLP-1234 and put them in Qase suite Checkout.`

## Standard Workflow (Jira → Qase → Jira)

1. **Read Jira and formulate required coverage internally.** Retrieve the ticket via Jira/Atlassian MCP. Read the full Description/User Story, AC (check both the dedicated AC field, e.g. `customfield_10183`, and the Description), business rules, platform/module, clarifying comments, and accessible relevant attachments (including Figma/UI images when present). Formulate the required test coverage using `qa-test-case-convention.md`. **Never generate from the title alone, and never invent behavior, ACs, or business rules that the ticket does not state.** Track which AC number(s) each behavior covers — needed for the final Jira comment. See AC Sufficiency Check below before proceeding.
2. **Check Qase for existing related test cases, and confirm the suite structure.** Resolve the Qase destination (project + module suite; see mapping). Retrieve existing cases and sub-suites in the target module and closely related ones via Qase MCP. **If the module suite or its action sub-suites do not exist yet (empty/new module), plan to create them per `qase-suite-organization.md`** — creating test cases in Qase always includes putting them under the correct suite structure, not a bare parent suite. New sub-suites are part of the plan presented in step 5 and created in step 7.
3. **Compare** required coverage (from Jira) against existing Qase cases.
4. **Classify each case, and align it to the suite structure.** Put every case in exactly one bucket, and at the same time determine where it belongs in the suite per `qase-suite-organization.md`:
   - **KEEP** — existing case remains valid, no content change (may still be flagged for a suite move).
   - **UPDATE** — existing case needs modification for the new requirement (preserve its behavior/intent/validation strings; change only what the requirement dictates). A title/expression-only fix to meet convention is an UPDATE.
   - **REMOVE** — existing case is no longer applicable/supported, or a confirmed duplicate.
   - **ADD** — new coverage is required; write a new case per the convention.
   - **MOVE** — case is in the wrong sub-suite; flag it to be relocated (update `suite_id` only).
   See Classification Rules and Suite Refinement below. Refining and aligning existing cases happens together with coverage — the same pass cleans up structure and convention, not just gaps.
5. **Present proposed changes, suite structure, and titles for QA review.** Show the KEEP / UPDATE / REMOVE / ADD / MOVE plan grouped by target sub-suite (see Review Presentation). For UPDATE/ADD, include the case content (Title, Description, Preconditions, Steps, Expected Result, Test Data as applicable) and the AC number(s) each covers. Include any new sub-suites to be created and cases to be moved. Use temporary `TC-01` labels; never invent Qase IDs. Use native review/approval UI when available.
   - **Revise** only requested cases/fields on request, preserve unchanged content, reassess AC coverage if scope changes, and present again.
6. **QA approves.** This is the single approval gate. Never create/update/remove/move Qase cases or suites, and never post the Jira comment, before approval.
7. **Apply approved changes in Qase.** Create any approved sub-suites first, then execute the approved UPDATE / REMOVE / ADD / MOVE (KEEP is a no-op). Place each new case directly in the correct sub-suite. Moving a case = update `suite_id` only; never recreate to move (preserve case IDs and history). Preserve approved content except Qase-required field formatting. Never introduce new scenarios during execution. Never remove a case that was not approved for removal.
8. **Retrieve and validate the final test case set from Qase.** Re-fetch the target suite(s) from Qase and confirm the applied changes match the approved plan (expected cases exist with correct titles/IDs, removed cases are gone). This validated set — with real Qase IDs — is the source of truth for the Jira comment.
9. **Comment the finalized Qase set to the Jira ticket.** Post the validated Qase cases as a comment on the same ticket using the `jira-testcase-comment` skill's ADF format, grouped by behavior (Valid / Negative / Edge). The comment must mirror Qase, not regenerate from the ticket. See Final Jira Comment below.

### Important Rule — Qase success gates the Jira comment
The Jira comment must reflect the **actual finalized test cases stored in Qase**. If any Qase create, update, or remove operation fails, **do NOT post the Jira comment**. Report the specific Qase failure, stop, and only post to Jira once the Qase changes are successfully completed and validated (step 8).

## AC Sufficiency Check (before generating)
Analyze the ticket's Acceptance Criteria — but only as deeply as needed to write correct cases:
- If the AC (in the AC field or description) is **sufficient**, proceed. Do not over-analyze or re-derive requirements that are already clear.
- If the AC is **missing, unclear, or incomplete for the behavior in scope**, **ask the user** — do not guess or fabricate from the title/story. Group the questions.
- When the ticket references a design or the behavior is UI-heavy, **ask for Figma/UI screenshots** (or point to the attached ones) so steps, labels, and expected results are concrete rather than assumed.
- Flag any AC that seems contradictory, ambiguous, or gapped, and confirm before generating cases for it. Keep confirmed ticket facts separate from your interpretation.

Balance: ask when it materially affects correctness or coverage; don't stall a ticket whose AC is already good enough.

## Classification Rules (KEEP / UPDATE / REMOVE / ADD)
- Base classification on the behavior under test versus the Jira requirement, not on title wording alone.
- **KEEP** when an existing case already covers a required behavior correctly and conforms to `qa-test-case-convention.md`. Also use KEEP-with-rephrase sparingly: if only the title/expression breaks convention but the behavior is unchanged, treat it as UPDATE (title only) and say so.
- **UPDATE** when the requirement changes expected result, steps, data, or scope of an existing case. Preserve original intent, exact validation strings, and values; change only what the requirement dictates.
- **REMOVE** only for cases whose behavior is no longer applicable/supported, or confirmed true duplicates (same behavior, condition, and expected result). Prefer merging into the clearer canonical case over deleting a distinct AC case. Never assume a duplicate from titles alone.
- **ADD** for approved behaviors/ACs not covered by any existing case. Follow medium granularity; do not pad with trivial or out-of-scope cases.
- **MOVE** when a case tests a behavior that belongs under a different sub-suite than where it currently sits. MOVE is orthogonal to KEEP/UPDATE — a case can be both UPDATE and MOVE. Apply `qase-suite-organization.md`.
- Keep confirmed Jira facts separate from interpretation; never invent behavior, messages, statuses, or fields.

## Review Presentation
Present the plan **grouped by target sub-suite**, showing the classification per case, plus any new sub-suites and moves, so QA reviews content and structure together, e.g.:

```
## Proposed Qase Changes for TLP-1234 — module suite: <Module>

New sub-suites to create: View, Status   (if any)

▸ Create
  KEEP    [ID] <existing title>
  UPDATE  [ID] <title> — <what changes and why>
  ADD             <new title>  (covers: AC2, AC3)

▸ View
  MOVE    [ID] <title> — from Create → View
  ADD             <new title>  (covers: AC5)

▸ Update
  REMOVE  [ID] <title> — <reason: no longer supported / duplicate of [ID]>
```
For UPDATE and ADD, also include the full case content (per convention) so QA reviews actual cases, not just titles.

### Batching large reviews
For a large scope (roughly 60+ cases, or a broad multi-suite refinement), do not dump one giant plan. Split the review so it stays digestible: **present and get approval per sub-suite, or in reasonable batches.** Assess whether per-sub-suite or fixed-size batches read better for the given set, then proceed batch by batch — apply each approved batch (or hold all applies until the full plan is approved, per the user's preference). Keep the overall plan summary visible so QA sees the whole picture even while reviewing a part.

## Suite Refinement (structure — part of the same pass)
Aligning and refining the suite happens **together with** the coverage/classification pass, not as a separate afterthought. Apply `qase-suite-organization.md`:
- Verify the destination is the correct module/feature suite. Use the project's action-based **flat sub-suites** — **Create / View / Update / Delete / Status**, single level, no over-nesting — unless the project clearly follows another deliberate scheme (confirm before reshaping).
- Include only the sub-suites the module needs; create missing ones (step 7) before placing or moving cases.
- Categorize each case by the behavior under test, not incidental steps (a delete case that filters by status is still Delete).
- **MOVE** any misplaced existing case by updating its `suite_id` only — never recreate/duplicate to move; preserve case IDs and history.
- Leave the parent/module suite free of direct cases once sub-suites are in use.
- Refinement also brings existing cases into `qa-test-case-convention.md` (via UPDATE) — see Convention Check During Reconciliation.

## Final Jira Comment (step 9)
After Qase changes succeed and are validated, post the finalized cases to the Jira ticket via the `jira-testcase-comment` skill, with these pipeline-specific overrides:
- **Source of truth is Qase**, not the ticket. Use the validated Qase case titles (and include Qase IDs).
- **Group by test behavior**, one ADF table per group, each under its own heading in this order: **Valid Tests**, **Negative Tests**, **Edge Cases**. Omit a group that has no cases.
- **Column 1 = Test Case Title**, with the covered **AC number(s)** on the line directly beneath the title in the same cell (e.g. `AC: 1, 3`). Do not put steps/preconditions in this column for the pipeline comment.
- **Columns 2–4** unchanged: **Test Data | Remark (blank) | Status** (green `Test Passed` / red `Test Failed` checkboxes).
- If a prior test-case comment exists on the ticket, update it (pass `commentId`) rather than stacking duplicates.

## Report results
Report accurately at each stage; do not claim Qase or Jira success unless the MCP confirms it.

## Convention Check During Reconciliation
When classifying existing cases (step 4), also check them against `qa-test-case-convention.md`. Flag cases that break convention: titles not in `<Expected Behavior> when <Condition>` form or using `Verify/Check/Test/works correctly`; missing/merged expected results; micro-action steps; preconditions embedded in steps; missing test data. Bring non-conforming cases into convention via **UPDATE** (title/expression only) while preserving their original behavior, exact validation strings, values, and intent. Do not change what a case tests, only how it is expressed.

## Safety
- Get explicit QA approval (step 6) before any create/update/remove. There is a single approval gate.
- Deletions are hard and unrecoverable via API; only REMOVE confirmed duplicates or cases explicitly approved for removal.
- Report the final structure and counts after applying.

## Jira → Qase Project Mapping
- TLP → TLPE
- BLR → BLR
- DZ → DIZ
- MOB → EWS
- WARP → WARP
- ES → ES

If unmapped, ask; never guess.

## Lightweight Requests
If the user asks only for titles/ideas/scenarios/coverage, return only that detail. Do not touch Qase and do not post to Jira unless later requested.

## Tool Failure
If Jira or Qase MCP fails, state the specific issue briefly, never fabricate content or a success status, and ask only for the minimum content needed to continue manually. Per the Important Rule, a Qase failure blocks the step-9 Jira comment.
