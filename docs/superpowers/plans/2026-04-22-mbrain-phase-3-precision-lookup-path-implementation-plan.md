# Phase 3 Precision Lookup Path Implementation Plan

1. Add failing tests for exact path lookup in service and operation coverage.
2. Extend `PrecisionLookupRouteInput` with `path`.
3. Reuse paginated manifest reads to resolve an exact canonical page by path.
4. Update the existing precision benchmark to assert the path case.
5. Run targeted tests, benchmark, then shared regressions.
