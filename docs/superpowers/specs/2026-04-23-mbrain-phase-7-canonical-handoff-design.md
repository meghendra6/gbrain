# MBrain Phase 7 Canonical Handoff Design

## Goal

Introduce explicit canonical handoff records so a promoted inbox candidate can be linked to its target domain without treating `promoted` status as an implicit canonical write.

## In Scope

- explicit handoff records for promoted candidates only
- target domains:
  - `curated_note`
  - `procedure`
  - `profile_memory`
  - `personal_episode`
- a shared operation to record handoffs
- a read surface for inspecting recorded handoffs
- benchmark and Phase 7 acceptance wiring for the handoff slice

## Out Of Scope

- mutating the target domain itself
- rewriting Markdown notes or procedures
- historical-validity checks
- automatic handoff creation during promotion

## Minimal Model

Persist one handoff record containing:

- `id`
- `scope_id`
- `candidate_id`
- `target_object_type`
- `target_object_id`
- `source_refs`
- `reviewed_at`
- `review_reason`

The handoff record proves that a promoted candidate was deliberately handed off toward canonical memory. It does not claim the canonical target has already been edited.

## Handoff Rules

1. Only `promoted` candidates may be handed off.
2. The handoff target must match the candidate's own `target_object_type` and `target_object_id`.
3. Candidates with `target_object_type: null` or `other` are ineligible for handoff in this slice.
4. Handoff provenance must preserve the candidate's `source_refs`.
5. The same promoted candidate may create at most one handoff record for the same target.
6. Recording a handoff must not mutate the candidate row or the canonical target.

## Guardrails

- no direct canonical writes in this slice
- no handoff for rejected, staged, or superseded candidates
- no cross-scope handoff
- handoff inspection must show enough provenance to audit why canonicalization was allowed to proceed later

## Proof

This slice is complete when:

- service tests prove promoted-only handoff behavior and provenance preservation
- operation tests prove the shared handoff and read surfaces
- tests prove recording a handoff does not mutate the candidate row
- the dedicated benchmark passes
- the Phase 7 acceptance pack includes the handoff slice
