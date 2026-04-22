# MBrain Phase 7 Historical Validity Implementation Plan

## Task 1: Add Red Tests

- add service tests for:
  - valid handed-off candidate returns `allow`
  - stale review window returns `defer` without widening fallback policy
  - newer promoted peer returns `deny` with `supersede`
  - staged competing peer returns `defer` with `unresolved_conflict`
- add operation tests for shared read surface and invalid params
- add benchmark shape test
- extend the Phase 7 acceptance-pack expectation with the historical-validity slice
- run the focused tests first and confirm failure is caused by the missing slice

## Task 2: Add Minimal Read Support

- extend memory-candidate list filters to support `target_object_id`
- keep the new filter additive and backend-consistent across SQLite, PGLite, and Postgres
- reuse existing canonical handoff records rather than adding a new persistence table

## Task 3: Implement The Historical Validity Service

- add `historical-validity-service.ts`
- require a promoted candidate plus explicit canonical handoff
- compare review age against deterministic thresholds
- compare only peers bound to the same `scope_id` and canonical target
- keep the result read-only with explicit fallback recommendations

## Task 4: Publish The Shared Operation

- add `assess_historical_validity`
- keep the surface bounded and deterministic
- do not add state mutation or automatic contradiction/supersession writes

## Task 5: Acceptance Wiring

- add `scripts/bench/phase7-historical-validity.ts`
- extend `scripts/bench/phase7-acceptance-pack.ts`
- update `test/phase7-acceptance-pack.test.ts`
- update `package.json` and `docs/MBRAIN_VERIFY.md`

## Task 6: Verification And Review

- run focused historical-validity tests
- run `bun run bench:phase7-historical-validity --json`
- run `bun run bench:phase7-acceptance --json`
- run spec review subagent, fix valid findings
- run quality review subagent, fix valid findings
