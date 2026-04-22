# Phase 5 Memory Inbox Supersession Design

## Goal

Add the first explicit replacement outcome to the Memory Inbox by marking an
older candidate as `superseded` and recording the link to the newer promoted
candidate that replaced it.

## Scope

- add `superseded` as a canonical Memory Candidate status
- add one durable supersession record type and persistence table
- support one dedicated supersession service and one shared operation
- require the replacement candidate to already be `promoted`
- keep the slice bounded to candidate-governance history only

## Non-Goals

- contradiction classification beyond explicit replacement
- target-domain rewrites or canonical note edits
- bulk supersession review
- background duplicate detection or recurrence scoring

## Design Choice

Three approaches were considered:

1. Reuse rejection and store a free-form review note saying another candidate won.
2. Publish `superseded` plus an explicit old/new link record.
3. Skip supersession and wait for contradiction handling to cover all replacement cases.

The chosen design is **2**.

Reasons:

- supersession is a durable governance outcome, not just a rejection reason
- explicit old/new linking keeps review history auditable
- it closes one of the explicit outcomes required by the governance workstream
  without widening into contradiction resolution yet

## Rules

Supersession should evaluate:

1. superseded candidate exists
2. replacement candidate exists
3. candidate ids differ
4. both candidates share the same `scope_id`
5. superseded candidate is currently `staged_for_review` or `promoted`
6. replacement candidate is currently `promoted`
7. supersession writes `status='superseded'` on the old candidate
8. supersession writes one durable link record with old/new ids and review metadata
9. the candidate status change and the link record must be committed atomically

This slice keeps the replacement candidate unchanged. It only records that the
older candidate lost to a newer promoted one.

## Operation Surface

This slice should expose one new operation:

- `supersede-memory-candidate`

Expected params:

- `superseded_candidate_id`
- `replacement_candidate_id`
- `reviewed_at`
- `review_reason`

Operation rules:

- mutating
- thin adapter over the supersession service
- missing ids still map to `memory_candidate_not_found`
- non-supersedable candidates map to stable invalid-params style errors

## Acceptance

This slice is complete when:

- schema and engine tests prove `superseded` is a valid canonical status
- schema and engine tests prove one durable supersession record can be read back
- service tests prove staged or promoted candidates can be superseded only by a
  promoted replacement in the same scope
- operation tests prove the new CLI surface is registered and returns explicit
  supersession output
- benchmark reports one new slice: `memory_inbox_supersession`
- `phase5-acceptance` passes with:
  - `memory_inbox_foundations`
  - `memory_inbox_rejection`
  - `memory_inbox_promotion_preflight`
  - `memory_inbox_promotion`
  - `memory_inbox_supersession`
