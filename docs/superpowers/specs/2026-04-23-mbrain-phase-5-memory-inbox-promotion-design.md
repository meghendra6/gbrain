# Phase 5 Memory Inbox Promotion Design

## Goal

Add the first explicit positive governance outcome to the Memory Inbox by
supporting deterministic promotion of staged candidates that pass promotion
preflight.

## Scope

- add `promoted` as a canonical Memory Candidate status
- support one dedicated promotion service and one shared operation
- require a passing promotion preflight before promotion succeeds
- keep target-domain writes bounded to the existing target link fields already
  stored on the candidate
- publish one additional Phase 5 benchmark slice and acceptance wiring

## Non-Goals

- mutating curated notes, procedures, profile memory, or personal episodes
- adding a separate promotion-record table in this slice
- supersession or contradiction handling
- reviewer batching or queue UX

## Design Choice

Three approaches were considered:

1. Write directly into target domains during promotion.
2. Publish `promoted` as an explicit governance outcome first.
3. Skip promotion and go directly to supersession logic.

The chosen design is **2**.

Reasons:

- it closes the positive governance path without widening into target-domain
  mutation
- it reuses the promotion-preflight contract from the previous slice
- it keeps rollback simple because promotion remains canonical governance state

## Rules

Promotion should evaluate:

1. candidate exists
2. candidate is currently `staged_for_review`
3. promotion preflight returns `allow`
4. promotion writes `status='promoted'`
5. explicit `reviewed_at` should still preserve `null` when provided
6. explicit `review_reason` should remain attached as audit metadata

This slice keeps `target_object_type` and `target_object_id` as the canonical
promotion link. It does not add a separate target-domain handoff record yet.

## Operation Surface

This slice should expose one new operation:

- `promote-memory-candidate`

Expected params:

- `id`
- `reviewed_at`
- `review_reason`

Operation rules:

- mutating
- thin adapter over the promotion service
- missing ids still map to `memory_candidate_not_found`
- non-promotable candidates map to stable invalid-params style errors

## Acceptance

This slice is complete when:

- schema and engine tests prove `promoted` is a valid canonical status
- service tests prove staged promotable candidates transition to `promoted`
- operation tests prove the new CLI surface is registered and returns promoted
  candidate state
- benchmark reports one new slice: `memory_inbox_promotion`
- `phase5-acceptance` passes with:
  - `memory_inbox_foundations`
  - `memory_inbox_rejection`
  - `memory_inbox_promotion_preflight`
  - `memory_inbox_promotion`
