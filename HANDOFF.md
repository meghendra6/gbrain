# Session Handoff — Sprint 1.0 Execution

**From:** 2026-04-23 / 24 working sessions
**To:** next session (fresh context)
**Working directory:** `/Users/meghendra/Work/mbrain`
**Branch:** `scenario-test-suite`
**Tip commit:** `b6c2bcd docs: implementation plan for Sprint 1.0 interaction identity`

---

## 1. What's already done — do not redo

- **Scenario test suite** (PR #37, open) — 14 scenarios + helpers + `test:scenarios` npm script. Already landed on this branch. Includes engine-level I4 fix (promotion refuses empty `source_refs` on all three engines).
- **Architecture guide** — `docs/mbrain-architecture-guide.html` explains mbrain end-to-end with 8 SVG diagrams. Reference for context.
- **Three Sprint specs** on this branch:
  - `docs/superpowers/specs/2026-04-24-mbrain-sprint-0-tsc-baseline-design.md` — Track A (tsc cleanup)
  - `docs/superpowers/specs/2026-04-24-mbrain-sprint-1-0-interaction-identity-design.md` — foundation
  - `docs/superpowers/specs/2026-04-24-mbrain-sprint-1-1-loop-observability-design.md` — built on 1.0
  - A legacy spec (`2026-04-24-mbrain-sprint-1-loop-observability-design.md`) is marked **SUPERSEDED** at the top; ignore its body.
- **Sprint 1.0 implementation plan** — `docs/superpowers/plans/2026-04-24-mbrain-sprint-1-0-interaction-identity-plan.md`. Six tasks, each one commit. Ready to execute task by task.

---

## 2. What's next — execute Sprint 1.0

Open the plan file and work through tasks 1 → 6 in order. Each task ends with a single commit. Do not bundle tasks.

The plan's header references two execution sub-skills:

- `superpowers:subagent-driven-development` (recommended) — fresh subagent per task, review between tasks.
- `superpowers:executing-plans` — inline batch execution with checkpoints.

Pick one when starting. Both are acceptable.

### Expected final state after Sprint 1.0

- 6 new commits on `scenario-test-suite` (tasks 1–6) plus a post-task push + PR open.
- New PR separate from #37 (or stacked), titled `feat: sprint 1.0 — agent-turn identity foundation`.
- Full `bun test` green; at least 10 new tests pass (S17 ×3, S18 ×1, S19 ×2, S20 ×2, interaction-schema ×2).

### Do-not-touch boundaries (policy, not preference)

- **`memory_candidate_entries` schema** — spec §3 explicitly excludes it. Adding `interaction_id` there is a policy violation because the row is mutable state (FSM). Turn attribution for capture / advance / reject transitions is deferred to a future `memory_candidate_status_events` table.
- **`retrieval_traces` schema extensions** (`derived_consulted`, `write_outcome`, etc.) — Sprint 1.1, not 1.0.
- **CI `tsc --noEmit`** — Sprint 0 (Track A), not here.
- **`operations.ts` / CLI / MCP surface** — Sprint 1.1 adds the audit op.

### Migration 21

Already designed in the spec (§6.3) and plan (Task 3). Pattern matches migration 20's `canonical_handoff_records`. Columns are nullable `TEXT`. **No FK** on `interaction_id` (loose coupling by design).

---

## 3. Context that saves re-derivation time

### Repo conventions you must preserve

- **Contract-first**: CLI and MCP both generated from `src/core/operations.ts`. Do not add user-visible operations in Sprint 1.0 (that's 1.1).
- **Forward-only migrations**: `src/core/migrate.ts` and `src/core/sqlite-engine.ts` case ladder. Never modify a landed migration; always append.
- **Scenario test pattern**: each `test/scenarios/sNN-*.test.ts` starts with a JSDoc block that quotes the invariant it falsifies, from `docs/architecture/redesign/00`–`08`.
- **Per-test timeout override for cold-start engines**: `const ENGINE_COLD_START_BUDGET_MS = 30_000;` + pass as third arg to `test(..., async () => {...}, ENGINE_COLD_START_BUDGET_MS)`. Needed for PGLite full-suite runs.

### Known pre-existing issues that are NOT yours to fix in Sprint 1.0

- `bunx tsc --noEmit` currently reports **836 errors / 1487 output lines**. Sprint 0 owns this cleanup. Do not bundle tsc fixes into Sprint 1.0 commits.
- Some PGLite tests are flaky under full-suite load without per-test timeout overrides. Plan Task 3 already specifies the override for the new schema test.
- Task-scoped trace assumption is intentionally being fixed in Sprint 1.0 — that is literally this sprint's goal.

### Files you'll touch (from plan)

```
src/core/types.ts                                      [Task 1, 4]
src/core/services/retrieval-route-selector-service.ts  [Task 2]
src/core/migrate.ts                                    [Task 3]
src/core/sqlite-engine.ts                              [Task 3, 4]
src/core/pglite-engine.ts                              [Task 4]
src/core/postgres-engine.ts                            [Task 4]
src/core/services/canonical-handoff-service.ts         [Task 5]
src/core/services/memory-inbox-supersession-service.ts [Task 5]
src/core/services/memory-inbox-contradiction-service.ts[Task 5]
test/scenarios/s17-task-less-trace.test.ts             [Task 2 · NEW]
test/scenarios/interaction-schema.test.ts              [Task 3 · NEW]
test/scenarios/s18-interaction-id-handoff.test.ts      [Task 6 · NEW]
test/scenarios/s19-interaction-id-supersession.test.ts [Task 6 · NEW]
test/scenarios/s20-interaction-id-nullable.test.ts     [Task 6 · NEW]
```

No other files need to change. If you find yourself editing outside this list, stop and re-read the plan.

---

## 4. Verification commands

Use these exact commands — they are referenced throughout the plan.

```bash
# Before starting — confirm starting state
git status                          # expect clean
git rev-parse --abbrev-ref HEAD     # expect scenario-test-suite
git --no-pager log --oneline -3     # expect tip at b6c2bcd

# Per-task verification (plan specifies exact commands per step)
bun test test/scenarios/sNN-*.test.ts
bun test                            # full suite before each commit

# Final verification
bun run test:scenarios              # all scenarios green
bun test                            # repo-wide green
```

If `bun test` reports more failures than it did on the pre-sprint baseline, stop and investigate — do not commit.

---

## 5. Open PRs at handoff

| # | Title | State | Branch | Note |
|---|---|---|---|---|
| 37 | test: scenario-based test suite grounded in redesign contract | open | `scenario-test-suite` | The base this handoff continues |

Sprint 1.0 ends with a new PR (separate or stacked on #37). The plan's post-task step has the `gh pr create` command ready.

---

## 6. If things go wrong

- **Migration applies on SQLite but fails on PGLite**: the partial index pattern differs. SQLite case 21 in the plan uses plain `CREATE INDEX`; Postgres/PGLite use `WHERE interaction_id IS NOT NULL`. Double-check the SQL.
- **`persistSelectedRouteTrace` tests break unexpectedly**: an existing test may have asserted the old "throw on missing task" behavior. Spec says that behavior changes intentionally — update the stale test once and note the reason in the commit.
- **Widening `RetrievalTrace.scope` produces many tsc errors**: expected. Fix inline in Task 1's commit. If an error is far from trace.scope (e.g., in an unrelated file), it is pre-existing; leave it for Sprint 0.
- **Cross-engine parity fails for supersession**: the trigger logic (Postgres/PGLite plpgsql vs SQLite hand-coded) was cross-verified in PR #36. If it regresses, start by reading `test/memory-inbox-schema.test.ts` which exercises all three engines.

---

## 7. Stop-hook note

The project's Stop hook enforces an mbrain-write reflex at session end. It will ask: "did you record any notable entities (people, companies, concepts, technical systems) in the brain?" For Sprint 1.0 execution sessions, the answer is normally **MBRAIN-PASS** — implementation artifacts are captured in the PR and docs, not as world-knowledge entries. If something genuinely new and re-usable came up (e.g., an unexpected architectural constraint you discovered), record it. Otherwise respond `MBRAIN-PASS: <reason>` and continue.

---

## 8. Bootstrapping prompt for the next session

Copy the block below into the new session as the first message.

> I'm picking up Sprint 1.0 execution for mbrain from a prior session. All context is in `HANDOFF.md` at the repo root (`/Users/meghendra/Work/mbrain/HANDOFF.md`) — please read it first, then read the referenced plan at `docs/superpowers/plans/2026-04-24-mbrain-sprint-1-0-interaction-identity-plan.md`. The spec is `docs/superpowers/specs/2026-04-24-mbrain-sprint-1-0-interaction-identity-design.md`.
>
> Current branch is `scenario-test-suite`, tip commit `b6c2bcd`. The plan has 6 tasks each producing one commit. Execute them in order using the `superpowers:subagent-driven-development` sub-skill (fresh subagent per task, review between tasks). If subagent dispatch is unavailable in this environment, fall back to `superpowers:executing-plans` with checkpoints.
>
> After Task 6, push the branch and open a new PR using the `gh pr create` command included in the plan's post-tasks section.
>
> Constraints you must respect (full detail in HANDOFF.md §2):
>
> - Do **not** add `interaction_id` to `memory_candidate_entries` (mutable state — policy).
> - Do **not** extend `retrieval_traces` with `derived_consulted` / `write_outcome` / etc. — that is Sprint 1.1.
> - Do **not** add `bunx tsc --noEmit` to CI — that is Sprint 0.
> - Do **not** add CLI or MCP operations — that is Sprint 1.1.
>
> Before Task 1, verify starting state: `git status` clean, branch `scenario-test-suite`, tip `b6c2bcd`. If any mismatch, stop and flag it.

That's all. Good luck.
