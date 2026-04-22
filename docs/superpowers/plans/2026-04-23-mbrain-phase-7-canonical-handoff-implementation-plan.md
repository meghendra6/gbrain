# MBrain Phase 7 Canonical Handoff Implementation Plan

## Task 1: Add Red Tests

- add service tests for promoted-only handoff creation, provenance preservation, duplicate prevention, and read-only candidate behavior
- add operation tests for recording and listing handoffs
- add benchmark shape test
- add the handoff benchmark to the Phase 7 acceptance-pack expectation
- run the focused handoff tests first and confirm failure is caused by the missing slice

## Task 2: Add The Minimal Handoff Record

- add handoff types and engine contract
- add the minimal schema for explicit handoff records
- update SQLite, PGLite, and Postgres persistence paths for handoff records
- keep target domains untouched

## Task 3: Implement The Handoff Service

- add `canonical-handoff-service.ts`
- require `promoted` candidate status
- preserve candidate provenance and target binding

## Task 4: Publish The Shared Operations

- add `record_canonical_handoff`
- add `list_canonical_handoff_entries`
- keep both surfaces explicit and bounded

## Task 5: Acceptance Wiring

- add `scripts/bench/phase7-canonical-handoff.ts`
- add `scripts/bench/phase7-acceptance-pack.ts`
- update `package.json` and `docs/MBRAIN_VERIFY.md`

## Task 6: Verification And Review

- run focused handoff tests
- run `bun run bench:phase7-canonical-handoff --json`
- run `bun run bench:phase7-acceptance --json`
- run spec review subagent, fix valid findings
- run quality review subagent, fix valid findings
