# MBrain Redesign Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining redesign work after PR #42 so `mbrain` can keep proving the brain-agent loop runs, keep strict type regressions out of CI, and close the remaining scenario contract gaps.

**Architecture:** The completion path remains loop-first: `retrieval_traces.id` is the agent-turn identity, linked governance event rows attach by `interaction_id`, and audit reads trace/write joins instead of free-form strings. Canonical Markdown and operational records remain truth; maps, atlases, embeddings, and audit reports are orientation or evaluation artifacts unless explicitly promoted through governance.

**Tech Stack:** Bun, TypeScript, SQLite (`bun:sqlite`), PGLite, Postgres, existing `BrainEngine` boundary, `operations.ts` operation registry, scenario tests under `test/scenarios`, GitHub Actions.

---

## Current Integrated State

As of 2026-04-25 on `origin/master` after PR #42:

- PR #38 is merged: Sprint 1.0 interaction identity foundation.
- PR #39 is merged: Postgres JSONB persistence correctness and legacy scalar-string repair.
- PR #40 is merged: Sprint 1.1A retrieval trace fidelity fields.
- PR #41 is merged: redesign completion roadmap.
- PR #42 is merged: Sprint 1.1B brain-loop audit.
- Latest merge commit: `528b07d Merge pull request #42 from meghendra6/sprint-1.1b-loop-audit`.
- `audit_brain_loop` exists and reports trace counts, intent/scope/gate distributions, canonical-vs-derived counts, linked write counts, approximate unlinked-candidate counts, task compliance, and summary lines.
- PR #42 final local verification passed with `bun test --timeout 60000`: `1156 pass / 140 skip / 5 todo / 0 fail`.
- PR #42 final GitHub checks passed: `test`, `postgres-jsonb`, `gitleaks`, and `Tier 1 (Mechanical)`. `Tier 2 (LLM Skills)` was skipped by workflow conditions.
- Current `test/scenarios` placeholders remain: S5 has 1 `test.todo`, S9 has 2 `test.todo`, and S11 has 2 `test.todo`.
- `bunx tsc --noEmit --pretty false` still fails on latest `origin/master`. Baseline re-measured on 2026-04-25: `851` `error TS` lines.

The redesign is not complete. The remaining contract gaps are:

- `tsc` is not green and therefore cannot be enforced in CI.
- Scenario contract placeholders remain for L1 request-level intent decomposition, L2 canonical-first broad synthesis, and L4 code claim verification.
- Final acceptance does not yet require zero scenario placeholders, clean `tsc`, full suite success, and a working CLI audit report on the final integrated state.
- Task compliance semantics are currently "all task threads in scope." An optional active-only compliance metric is a future policy decision, not a current completion blocker.

## Completion Definition

`mbrain` is considered complete against the current redesign set when all of these are true:

- `mbrain audit-brain-loop --since 24h --json` returns a structured report with trace counts, intent/scope/gate distributions, canonical-vs-derived counts, linked-write counts, approximate unlinked-candidate counts, task compliance, and summary lines.
- Linked write counts are computed by joining `retrieval_traces.id` to event-table `interaction_id`, not by parsing free-form text.
- The audit CLI behavior is verified again after the final acceptance branch lands, not only by PR #42's service and operation tests.
- Every scenario placeholder in `test/scenarios` is replaced by a real test or intentionally removed because the scenario is covered by a stricter test.
- `bun run test:scenarios` reports zero failing tests and zero scenario placeholders.
- `bun test` reports zero failing tests.
- `bunx tsc --noEmit --pretty false` reports zero errors locally and runs in CI before `bun test`.
- GitHub Actions include the existing default test job, gitleaks, E2E Tier 1, and the Postgres JSONB job from PR #39.
- The final docs state which invariants are implemented and which future product extensions are outside the redesign completion boundary.

## Dependency Graph

| Order | Scope | Branch Name | Depends On | Merge Gate | Status |
|---|---|---|---|---|---|
| 1 | Sprint 1.1B loop audit | `sprint-1.1b-loop-audit` | `master` after PR #40 | Audit scenarios green, full tests green | Done in PR #42, merge `528b07d` |
| 2a | Sprint 0 tsc baseline: engine contract | `sprint-0.1-tsc-engine-contract` | `origin/master` after PR #42 | `runMigration`/`SQLiteEngine` TypeScript family eliminated, focused tests green | Next |
| 2b | Sprint 0 tsc baseline: SQL/JSON binding types | `sprint-0.2-tsc-sql-json` | 2a | SQL binding, JSON parameter, and mapper callback TypeScript families eliminated | Pending |
| 2c | Sprint 0 tsc baseline: domain boundary types | `sprint-0.3-tsc-domain-boundaries` | 2b | config, file resolver, pglite lock, services, and storage TypeScript families eliminated | Pending |
| 2d | Sprint 0 tsc baseline: test fixture types | `sprint-0.4-tsc-test-fixtures` | 2c | test/scenario fixture TypeScript families eliminated | Pending |
| 2e | Sprint 0 tsc baseline: CI enforcement | `sprint-0.5-tsc-ci` | 2d | `bunx tsc --noEmit --pretty false` green locally and in CI before `bun test` | Pending |
| 3 | L1 request decomposition | `sprint-2-request-decomposition` | Sprint 0 typecheck CI merged | S5 placeholder replaced and green | Pending |
| 4 | L2 canonical-first ranking | `sprint-3-canonical-first-ranking` | Sprint 0 typecheck CI merged | S9 placeholders replaced and green | Pending |
| 5 | L4 code claim verification | `sprint-4-code-claim-verification` | Sprint 0 typecheck CI merged | S11 placeholders replaced and green | Pending |
| 6 | Final acceptance closure | `sprint-final-acceptance-closure` | 2a-5 | No scenario placeholders, `tsc` green, full suite green, CLI audit verified | Pending |

## Remaining Work

### Track A: TypeScript Baseline and CI

Detailed plan: `docs/superpowers/plans/2026-04-25-mbrain-sprint-0-tsc-baseline-current-plan.md`.

Purpose:

- Remove the current `851` TypeScript errors.
- Preserve runtime behavior while tightening types.
- Add `bunx tsc --noEmit --pretty false` to CI only after local `tsc` is clean.

Execution rule:

- Do not implement L1, L2, or L4 feature work until Track A is merged. Those PRs add new production code and should land under the typecheck gate.

### Track B: Remaining Scenario Contracts

Detailed plan: `docs/superpowers/plans/2026-04-25-mbrain-remaining-redesign-contracts-plan.md`.

Purpose:

- Replace S5 L1 request decomposition placeholder with a deterministic request planner.
- Replace S9 L2 canonical-first ranking placeholders by making broad synthesis prefer curated canonical notes over map-derived suggestions.
- Replace S11 L4 code claim verification placeholders by distinguishing historical memory from current workspace truth.
- Close final acceptance with zero scenario placeholders, clean `tsc`, full tests, build, and CLI audit verification.

Execution rule:

- Keep L1, L2, and L4 as separate semantic PRs. Do not combine request decomposition, broad-synthesis ranking, and code-claim verification.

## Retrospective Adjustments

The architecture does not need a redesign after PR #42. The core choice remains correct: measurement only became reliable after interaction identity existed, trace fidelity existed, and linked writes could be joined by `interaction_id`.

The execution plan does need these changes:

- PR #42 is now a completed foundation, not a next action.
- The next action is Sprint 0.1 because `SQLiteEngine` not satisfying `BrainEngine` creates a large `tsc` cascade. Fixing that first makes the remaining TypeScript inventory easier to review.
- Sprint 0 must be split into small PRs. A single "make tsc green" PR would be too broad and would violate the review discipline used successfully during PR #42.
- Critical subagent review remains required after each meaningful implementation commit, but review findings are hypotheses. They must be checked against design docs, code, and tests before implementation.
- Local worktree state must be treated carefully. New implementation starts from a clean worktree based on latest `origin/master`; do not reuse stale or dirty branches for new PRs.

## Non-Goals Until Completion

These remain explicitly outside the current completion boundary:

- Trace retention, TTL, or pruning.
- Dashboard/UI for loop observability.
- Scheduled cron automation for `audit_brain_loop`.
- Full `memory_candidate_status_events` event log for capture/advance/reject correlation.
- Active-only task compliance metric. Current audit reports all task threads in scope; active-only compliance can be added later if product policy requires it.

## Review Discipline for Every PR

Each PR follows the same checkpoint loop:

- Before implementation: create or switch to a clean worktree based on latest `origin/master`, then confirm branch base and current test state.
- For each task: write the failing test first, run it, implement the minimum fix, run focused tests, commit.
- After each meaningful commit: request a critical subagent review focused on correctness, scope creep, backend parity, and missing tests.
- Treat review comments as hypotheses, not commands. Verify against code and tests before changing behavior.
- Before merge: run focused tests, full `bun test`, `bun run build`, `git diff --check`, and `bunx tsc --noEmit --pretty false` once Track A is merged.
- Merge only one PR at a time. Rebase or retarget stacked branches after the base PR lands.

## Execution Recommendation

Proceed in this order:

1. Implement Track A PR 2a (`sprint-0.1-tsc-engine-contract`).
2. Continue Track A PRs 2b-2e until `bunx tsc --noEmit --pretty false` is green and CI enforces it.
3. Implement PR 3 (`sprint-2-request-decomposition`) to close S5.
4. Implement PR 4 (`sprint-3-canonical-first-ranking`) to close S9.
5. Implement PR 5 (`sprint-4-code-claim-verification`) to close S11.
6. Implement PR 6 (`sprint-final-acceptance-closure`) to update final docs and verify the integrated system.

This order avoids the earlier mistake of mixing observability, schema, CI, and feature semantics in one PR. It also keeps the audit available while later memory improvements land, which lets the project keep checking whether reads and writes are actually paired by agent turns.

## Self-Review

- Spec coverage: PR #42 covers Sprint 1.1B. Track A covers `2026-04-24-mbrain-sprint-0-tsc-baseline-design.md`. Track B covers remaining scenario invariants L1, L2, and L4 from `2026-04-23-mbrain-scenario-test-design.md`. Final acceptance closes `08-evaluation-and-acceptance.md`.
- Dependency check: L1/L2/L4 now depend on Track A so new feature work is protected by CI typecheck.
- Type consistency: Stable names remain `AuditBrainLoopReport`, `RetrievalTraceWindowFilters`, `audit_brain_loop`, `plan_retrieval_request`, and `reverify_code_claims`.
- Scope control: Candidate status-event logs, dashboards, pruning, cron automation, and active-only compliance are explicitly excluded from this completion boundary.
