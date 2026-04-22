# Phase 5 Memory Inbox Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic `promoted` governance outcomes for staged memory candidates that pass promotion preflight.

**Architecture:** Widen the canonical Memory Candidate status model just enough to include `promoted`, add one promotion service and one shared operation, and extend Phase 5 benchmark and acceptance coverage. Keep target-domain writes out of scope; the candidate row remains the explicit governance record.

**Tech Stack:** TypeScript, Bun, shared operations contract, SQLite/PGLite/Postgres engine implementations, Phase 5 benchmark and acceptance wiring.

---

## Task 1: Write RED tests for promoted status and service behavior

**Files:**
- Modify: `test/memory-inbox-schema.test.ts`
- Modify: `test/memory-inbox-engine.test.ts`
- Modify: `test/memory-inbox-service.test.ts`
- Modify: `test/memory-inbox-operations.test.ts`

- [ ] Add failing schema assertions that `promoted` is DB-valid.
- [ ] Add failing engine coverage that promoted status persists across reopen.
- [ ] Add failing service tests for promote success, explicit null `reviewed_at`, non-staged rejection, preflight-blocked rejection, and not-found rejection.
- [ ] Add failing operation tests for `promote_memory_candidate_entry` registration and behavior.

## Task 2: Implement the minimal promoted outcome

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/engine.ts`
- Modify: `src/core/migrate.ts`
- Modify: `src/core/sqlite-engine.ts`
- Modify: `src/core/pglite-engine.ts`
- Modify: `src/core/postgres-engine.ts`
- Create or modify: `src/core/services/memory-inbox-promotion-service.ts`
- Modify: `src/core/services/memory-inbox-service.ts`
- Modify: `src/core/operations-memory-inbox.ts`

- [ ] Add `promoted` to the canonical Memory Candidate status type and status surfaces.
- [ ] Add one additive migration that widens the DB status constraint to include `promoted`.
- [ ] Implement a promotion service that requires `staged_for_review` plus a passing promotion preflight result.
- [ ] Add one shared mutating operation, `promote_memory_candidate_entry`.

## Task 3: Benchmark and acceptance wiring

**Files:**
- Create: `scripts/bench/phase5-memory-inbox-promotion.ts`
- Create: `test/phase5-memory-inbox-promotion.test.ts`
- Modify: `scripts/bench/phase5-acceptance-pack.ts`
- Modify: `test/phase5-acceptance-pack.test.ts`
- Modify: `package.json`
- Modify: `docs/MBRAIN_VERIFY.md`

- [ ] Add one promotion benchmark slice with correctness plus latency workloads.
- [ ] Extend the Phase 5 acceptance pack to include promotion.
- [ ] Update `test:phase5` and verification docs.

## Task 4: Verify and review

**Files:**
- No new files beyond the slice above

- [ ] Run focused promotion tests and confirm green.
- [ ] Run `bun run bench:phase5-memory-inbox-promotion --json`.
- [ ] Run `bun run bench:phase5-acceptance --json`.
- [ ] Run `bun run test:phase5`.
- [ ] Run spec-review and code-quality subagents, fix valid findings, then rerun the relevant verification set.
