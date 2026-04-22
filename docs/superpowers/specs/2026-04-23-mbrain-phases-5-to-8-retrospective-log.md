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

What worked:
- Keeping the Phase 6 boundary at `inbox-only` prevented governance drift. Scoring and dedup stayed read-only, while map-derived capture wrote only new inbox candidates and never touched canonical stores directly.
- Reusing earlier artifacts was the right move. Candidate scoring reused Phase 5 inbox fields, map-derived capture reused context-map reports, and dedup reused scoring order instead of inventing a second priority system.
- Publishing the Phase 6 acceptance pack early made the phase closure straightforward once the third slice landed.

What failed or drifted:
- Early implementations still leaked hidden assumptions about bounded reads. Candidate scoring and dedup initially operated on capped raw reads instead of proving where pagination happened.
- Non-default scope behavior was easy to get wrong because several upstream helpers default to `workspace:default` unless scope is carried explicitly.
- Dry-run previews drifted from real write behavior until reviewers forced them to resolve actual scope from the selected map.

Valid review feedback that changed implementation:
- Candidate scoring docs needed explicit read-only regression coverage and deduplicated provenance handling.
- Map-derived capture had to carry explicit `map_analysis` semantics, respect the report read limit by default, and resolve scope from the selected map instead of silently falling back to `workspace:default`.
- Dedup backlog pagination had to happen after grouping, not before, and needed overflow coverage beyond the first 100 raw candidates.
- Stale map candidate tests needed stronger semantic checks so degraded candidates could not silently lose provenance or generated-by metadata.

Carry-forward execution rules for Phase 7:
- Any Phase 7 canonical handoff must prove the exact handoff record first; canonical writes cannot be inferred from candidate state alone.
- When a slice depends on an upstream artifact, carry the artifact scope and status end-to-end instead of reconstructing them from defaults.
- Add overflow and non-default-scope tests as soon as a read path introduces pagination or cross-scope selection.

## Phase 7

What worked:
- Splitting Phase 7 into `explicit handoff` and `historical validity` was the right boundary. The implementation never had to guess whether canonical intent existed, and it never had to fold stale-evidence logic into the handoff write path.
- Reusing Phase 5 governance state kept the phase additive. `promoted` remained necessary-but-not-sufficient, handoff became the explicit intent record, and historical validity stayed a read-only guard.
- Adding the Phase 7 acceptance pack early made phase closure straightforward. By the time historical validity landed, the pack only needed one additional slice instead of a last-minute test/benchmark scramble.
- Reviewer-driven parity work paid off. Phase 7 now has explicit SQLite/PGLite coverage for handoff persistence and target-bound peer filtering, with Postgres parity guarded by the existing `DATABASE_URL` pattern.

What failed or drifted:
- The first pass under-specified backend consistency. Duplicate handoff conflicts, empty-string filters, and the new `target_object_id` peer filter all needed explicit cross-backend hardening after review.
- Optional `Date` inputs were easy to validate only halfway. Both handoff and historical-validity paths initially accepted invalid `Date` objects that would have leaked runtime behavior or silently skipped safety checks.
- Documentation drift reappeared at the slice level. The historical-validity design kept a stale `refresh_evidence` fallback even after the plan and code had narrowed the contract.
- Early parity tests overfit ordering. Filter tests accidentally asserted one backend-specific row order instead of the actual contract, which is membership plus correct scoping.

Valid review feedback that changed implementation:
- Service-layer validation needed to reject invalid `Date` objects, not just malformed ISO strings.
- Duplicate handoff handling had to converge across SQLite, PGLite, and Postgres instead of relying on backend-specific conflict behavior.
- `list_canonical_handoff_entries` needed explicit non-empty scope validation, and engine filter checks needed to stop treating empty strings as “no filter”.
- Historical-validity peer comparison needed to stay same-scope and same-target, and the fallback contract needed to stay limited to `none | supersede | unresolved_conflict`.
- Phase 7 needed real cross-backend coverage for both handoff persistence and the new `target_object_id` peer filter instead of SQLite-only service tests.

Carry-forward execution rules for Phase 8:
- Any new evaluation or maintenance slice that accepts optional time inputs must validate both ISO strings and `Date` objects before calculating staleness or regressions.
- When a slice introduces or extends filters, add backend parity tests for the new filter in the same slice. Do not rely on one backend plus benchmark coverage.
- Keep benchmark contracts narrow and synchronized with the design docs; if a fallback or recommendation is not part of the roadmap slice, do not let it linger in docs or outputs.
- Prefer contract assertions over ordering assertions in parity tests unless ordering is itself the published behavior.

## Phase 8

Pending.
