# MBrain Phase 7 Historical Validity Design

## Goal

Add a read-only historical-validity guard so explicit canonical handoff records do not let older or outrun evidence proceed as if they were still current.

## In Scope

- one deterministic historical-validity assessment for a handed-off candidate
- current-evidence checks based on:
  - candidate promotion state
  - presence of an explicit canonical handoff record
  - review age
  - competing candidates bound to the same `scope_id` and canonical target
- explicit fallback recommendations:
  - `supersede`
  - `unresolved_conflict`
- one shared read operation
- benchmark and Phase 7 acceptance wiring for the validity slice

## Out Of Scope

- mutating canonical target domains
- automatically writing supersession or contradiction records
- background refresh or scheduled maintenance
- semantic similarity or fuzzy conflict detection

## Minimal Model

The slice remains read-only. It does not add a new persistence table.

It adds one assessment result:

- `candidate_id`
- `handoff_id`
- `decision`
- `stale_claim`
- `recommended_fallback`
- `reasons`
- `summary_lines`

## Decision Model

`decision` is one of:

- `allow`
- `defer`
- `deny`

`recommended_fallback` is one of:

- `none`
- `supersede`
- `unresolved_conflict`

## Validity Rules

1. A candidate may only be assessed if it still exists and is `promoted`.
2. A candidate without an explicit canonical handoff record is not eligible for `allow`.
3. A candidate whose status has already become `superseded` must surface as stale and recommend `supersede`.
4. A newer promoted candidate with the same `scope_id`, `target_object_type`, and `target_object_id` must mark the older handoff as stale and recommend `supersede`.
5. A staged competing candidate with the same `scope_id` and target binding must not silently pass. It must return `defer` with `unresolved_conflict`.
6. Review age must be bounded. Procedure targets stale faster than other canonical targets.
7. This slice never mutates inbox state. It only explains whether the handed-off claim is still safe to treat as current evidence.

## Thresholds

- `procedure` targets expire after `7` days without refreshed review
- all other eligible handoff targets expire after `30` days without refreshed review

## Reasons

- `candidate_not_promoted`
- `candidate_missing_handoff`
- `candidate_superseded`
- `newer_promoted_candidate_exists`
- `competing_candidate_under_review`
- `candidate_review_window_expired`
- `candidate_currently_valid`

## Proof

This slice is complete when:

- service tests prove allow, stale/deny, and defer outcomes
- operation tests prove the shared read surface and validation
- tests prove newer promoted peers and staged competitors are detected only within the same canonical target binding
- benchmark reports the validity slice and Phase 7 acceptance includes it
