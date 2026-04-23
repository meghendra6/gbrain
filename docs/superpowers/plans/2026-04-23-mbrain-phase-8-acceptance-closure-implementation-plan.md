# MBrain Phase 8 Acceptance Closure Implementation Plan

## Task 1: Add Red Tests

- add `test/phase8-acceptance-pack.test.ts`
- prove:
  - default run includes `longitudinal_evaluation` and `dream_cycle`
  - default run returns `readiness_status = pending_baseline` and `phase8_status = pending_baseline`
  - `--phase1-baseline <path>` forwards to longitudinal evaluation and returns `phase8_status = pass`
- run the focused test first and confirm failure is caused by the missing acceptance pack

## Task 2: Implement The Acceptance Pack

- add `scripts/bench/phase8-acceptance-pack.ts`
- run:
  - `scripts/bench/phase8-longitudinal-evaluation.ts --json`
  - `scripts/bench/phase8-dream-cycle.ts --json`
- forward optional `--phase1-baseline <path>` only to the longitudinal evaluator
- aggregate `pass | fail | pending_baseline` exactly as the design states, including pending readiness

## Task 3: Publish The Pack

- add `bench:phase8-acceptance` to `package.json`
- extend `test:phase8`
- update `docs/MBRAIN_VERIFY.md`

## Task 4: Retrospective And Review

- update `docs/superpowers/specs/2026-04-23-mbrain-phases-5-to-8-retrospective-log.md`
- run focused tests and acceptance benchmarks
- run spec review subagent, fix valid findings
- run code-quality review subagent, fix valid findings
