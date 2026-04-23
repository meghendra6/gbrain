# MBrain Phase 6 Map-Derived Candidates Design

## Goal

Bridge existing context-map report artifacts into `memory_candidate_entries` so structural analysis can propose reviewable candidates without bypassing Phase 5 governance.

## In Scope

- read an existing context-map report
- derive inbox candidates from `recommended_reads`
- persist those candidates in `captured` state only
- mark generated candidates as `map_analysis`
- degrade stale-map outputs instead of treating them as strong evidence
- benchmark and Phase 6 acceptance wiring for the bridge

## Out Of Scope

- building or rebuilding context maps
- deduplicating repeated capture runs
- promotion or canonical handoff
- non-map derived sources such as dream-cycle or retrieval traces
- direct canonical note edits

## Minimal Model

For each bounded recommended read in a selected map report, create one inbox candidate:

- `candidate_type`: `note_update`
- `generated_by`: `map_analysis`
- `status`: `captured`
- `target_object_type`: `curated_note`
- `target_object_id`: recommended read page slug

The candidate content should say that structural analysis recommends reviewing that page or section in the current map context.

## Derivation Rules

1. Candidate source is the existing map report, not a new map build.
2. Each candidate must include provenance for:
   - the map id
   - the selected recommended read path
3. Ready-map candidates use:
   - `extraction_kind: inferred`
   - medium confidence
   - `generated_by: map_analysis`
4. Stale-map candidates use:
   - `extraction_kind: ambiguous`
   - lower confidence
   - `generated_by: map_analysis`
5. Capture must stay bounded:
   - default exactly to the report's existing read limit
   - allow a smaller explicit capture limit

## Guardrails

- capture must create inbox candidates only
- capture must not mutate context-map entries
- capture must not create or edit canonical notes directly
- stale maps may create weaker candidates, but must never masquerade as fresh evidence

## Proof

This slice is complete when:

- service tests prove ready and stale map captures land in `captured` inbox state
- service tests prove captured candidates explicitly carry `generated_by: map_analysis`, the correct fresh/stale `extraction_kind`, and provenance for both map id and read path
- operation tests prove the shared capture surface and bounded limit behavior
- tests prove capture writes only inbox candidates and does not mutate the source map entry
- the dedicated benchmark passes
- the Phase 6 acceptance pack includes the new bridge slice
