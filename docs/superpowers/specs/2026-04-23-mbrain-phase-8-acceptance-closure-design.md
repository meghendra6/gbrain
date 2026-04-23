# MBrain Phase 8 Acceptance Closure Design

## Goal

Publish one Phase 8 acceptance pack that aggregates the longitudinal evaluation and dream-cycle maintenance slices, then record the final Phase 8 retrospective.

## In Scope

- one acceptance-pack benchmark:
  - `longitudinal_evaluation`
  - `dream_cycle`
- optional `--phase1-baseline <path>` forwarding to the longitudinal evaluation benchmark
- `pending_baseline` propagation when no comparable Phase 1 baseline artifact is provided
- Phase 8 verification docs
- Phase 8 retrospective log update

## Out Of Scope

- generating baseline artifacts
- changing Phase 1 baseline semantics
- adding more Phase 8 slices
- mutating any data stores

## Status Rules

The pack emits:

- `readiness_status = fail` if any child benchmark fails
- `readiness_status = pending_baseline` if no child fails and at least one child reports `pending_baseline`
- `readiness_status = pass` only when all children pass
- `phase8_status = fail` if any child benchmark reports `fail`
- `phase8_status = pending_baseline` if no child fails and at least one child reports `pending_baseline`
- `phase8_status = pass` only when all children pass

The process exits non-zero only when `phase8_status = fail`. A `pending_baseline` result is explicit and non-fatal because it is an evidence gap, not a runtime regression, but it means Phase 8 closure is not fully accepted until a comparable Phase 1 baseline is supplied.

## Proof

This slice is complete when:

- the acceptance-pack test proves default `pending_baseline` behavior
- the test proves `--phase1-baseline` can produce full `pass`
- the benchmark includes both Phase 8 child slices
- `test:phase8` includes the acceptance-pack test
- the retrospective log records Phase 8 wins, misses, valid review findings, remaining risks, and intentionally deferred work
