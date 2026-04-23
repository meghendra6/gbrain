# MBrain Phase 5 Memory Inbox Contradiction Design

## Goal

Close the remaining Phase 5 governance gap by making contradiction outcomes explicit, auditable, and durable inside the Memory Inbox boundary.

## In Scope

- deterministic contradiction outcomes for one challenger candidate against one challenged candidate
- explicit durable contradiction records
- three outcomes only:
  - `rejected`
  - `unresolved`
  - `superseded`
- reuse the existing rejection and supersession services for status-changing outcomes
- acceptance wiring for contradiction safety

## Out Of Scope

- map-derived candidate generation
- candidate scoring or deduplication
- canonical Markdown rewrites
- contradiction resolution against arbitrary source records or canonical pages
- UI workflow expansion

## Minimal Model

Persist a contradiction record that links:

- the challenger candidate
- the challenged candidate
- the contradiction outcome
- review metadata
- the supersession record when the contradiction resolves by superseding the older candidate

The first contradiction slice only supports candidate-to-candidate contradictions inside the same scope.

## Outcome Rules

### `rejected`

- challenger must resolve through the existing rejection path
- challenged candidate remains unchanged
- contradiction record persists the relationship and review metadata

### `unresolved`

- both candidates remain visible
- contradiction record persists the unresolved conflict
- no status mutation occurs

### `superseded`

- challenger must already be promoted
- challenged candidate resolves through the existing supersession path
- contradiction record persists and links to the supersession record

## Guardrails

- cross-scope contradictions are invalid
- self-contradictions are invalid
- contradiction handling must never silently overwrite state
- contradiction handling must stay inside the Memory Inbox boundary

## Proof

This slice is complete when:

- service tests prove reject, unresolved, and supersede outcomes
- operation tests prove shared-surface behavior and invalid-param handling
- schema and engine paths can persist contradiction records
- the dedicated contradiction benchmark and Phase 5 acceptance pack pass
