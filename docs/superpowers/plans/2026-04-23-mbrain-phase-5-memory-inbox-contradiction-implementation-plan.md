# MBrain Phase 5 Memory Inbox Contradiction Implementation Plan

## Task 1: Add Red Tests

- create contradiction service tests for `rejected`, `unresolved`, and `superseded`
- create contradiction operation tests for success and invalid metadata
- create contradiction benchmark shape test
- extend the Phase 5 acceptance-pack expectation with the contradiction benchmark
- run the focused contradiction tests first and confirm failure is caused by the missing slice

## Task 2: Add The Minimal Contradiction Record

- add contradiction types and engine contract
- add the minimal schema for durable contradiction records
- keep the model candidate-to-candidate only

## Task 3: Implement The Contradiction Service

- add `memory-inbox-contradiction-service.ts`
- reuse existing rejection and supersession services for status-changing outcomes
- keep `unresolved` read-write behavior minimal: persist the contradiction record and leave statuses unchanged

## Task 4: Publish The Shared Operation

- add `resolve_memory_candidate_contradiction`
- validate ids, outcome enum, and ISO review metadata
- map domain failures to shared operation errors

## Task 5: Acceptance Wiring

- add `scripts/bench/phase5-memory-inbox-contradiction.ts`
- extend `scripts/bench/phase5-acceptance-pack.ts`
- update `package.json` and `docs/MBRAIN_VERIFY.md`

## Task 6: Verification And Review

- run focused contradiction tests
- run `bun run bench:phase5-memory-inbox-contradiction --json`
- run `bun run bench:phase5-acceptance --json`
- run `bun run test:phase5`
- run spec review subagent, fix valid findings
- run quality review subagent, fix valid findings
