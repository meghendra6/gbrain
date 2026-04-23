# MBrain Phase 6 Map-Derived Candidates Implementation Plan

## Task 1: Add Red Tests

- add service tests for ready-map capture, stale-map degraded capture, explicit `generated_by` / `extraction_kind` semantics, and read-only source-map behavior
- add operation tests for shared capture surface, default report-limit behavior, and bounded smaller `limit`
- add benchmark shape test
- extend the Phase 6 acceptance-pack expectation with the map-derived benchmark
- run the focused map-derived tests first and confirm failure is caused by the missing slice

## Task 2: Implement The Minimal Bridge

- add `map-derived-candidate-service.ts`
- reuse the existing context-map report service instead of rebuilding maps
- create captured inbox candidates only

## Task 3: Publish The Shared Operation

- add `capture_map_derived_candidates`
- accept `map_id` or `scope_id`
- default to the report read limit and support a smaller explicit bounded `limit`

## Task 4: Acceptance Wiring

- add `scripts/bench/phase6-map-derived-candidates.ts`
- extend `scripts/bench/phase6-acceptance-pack.ts`
- update `package.json` and `docs/MBRAIN_VERIFY.md`

## Task 5: Verification And Review

- run focused map-derived tests
- run `bun run bench:phase6-map-derived-candidates --json`
- run `bun run bench:phase6-acceptance --json`
- run spec review subagent, fix valid findings
- run quality review subagent, fix valid findings
