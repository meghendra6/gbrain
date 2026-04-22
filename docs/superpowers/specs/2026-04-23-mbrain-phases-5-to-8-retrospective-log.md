# MBrain Phases 5 To 8 Retrospective Log

This log is updated at the end of each remaining roadmap phase. Each entry must state what worked, what failed, what review feedback was valid, and which execution rule changes carry forward into the next phase.

## Phase 5

What worked:
- The slice order was correct: `foundations -> rejection -> promotion_preflight -> promotion -> supersession -> contradiction`. Each slice stayed inside the governance boundary and avoided opening canonical-write side effects too early.
- Every public transition landed with both focused tests and a benchmark hook, so Phase 5 could close with a real acceptance pack instead of a loose checklist.
- Splitting memory-inbox operations into a dedicated domain module reduced the rate of accidental spillover into unrelated operation surfaces.

What failed or drifted:
- Early slices relied too much on operation-layer validation. Later reviews correctly forced service-layer and engine-layer checks for scope, provenance, timestamp, and invariant enforcement.
- Several low-level invariants were initially too soft: duplicate supersession races, contradiction persistence atomicity, and cross-scope persistence all needed hardening after review.
- Raw delete semantics are no longer a safe cleanup assumption once governance audit rows exist. Linked inbox candidates can become intentionally durable through supersession and contradiction records.

Valid review feedback that changed implementation:
- Promotion preflight and later governance outcomes needed service-layer enforcement, not just operation-layer checks.
- Promotion/supersession/contradiction paths needed transactional closure, duplicate-race handling, and low-level invariant guards in SQLite/PGLite/Postgres.
- Inbox surfaces needed explicit enum constraints, bounded list caps, separate default scope constants, and multi-source provenance support.

Carry-forward execution rules for Phase 6:
- Put policy in three places when it matters: operation validation, service-layer enforcement, and engine/database invariants.
- Keep Phase 6 outputs bounded to inbox candidates or review signals only. Do not let derived analysis write directly into canonical stores.
- Any governance outcome that creates durable audit rows must ship with explicit lifecycle semantics; do not assume raw delete remains valid cleanup.
- Close each slice with the benchmark and phase acceptance wiring in the same step; do not postpone measurement to the end of the phase.

## Phase 6

Pending.

## Phase 7

Pending.

## Phase 8

Pending.
