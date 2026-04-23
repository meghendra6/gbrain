# Phase 5 Memory Inbox Supersession Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Goal

Implement the bounded `superseded` governance outcome plus an explicit
supersession link record, without widening into contradiction handling.

## Guardrails

- [ ] Keep the slice bounded to explicit replacement history. Do not add
      contradiction classification yet.
- [ ] Keep target-domain writes unchanged. Replacement is recorded only at the
      candidate-governance layer.
- [ ] Preserve the promotion slice guarantees: direct creation of terminal
      statuses stays blocked, promotion remains separate, and atomic compare-and-
      swap writes are still required for terminal outcomes.
- [ ] Keep non-promotable and non-supersedable operation failures on the stable
      `invalid_params`-style surface used by the Phase 5 governance operations.

## Task 1: RED Tests

- [ ] Add failing schema tests for `superseded` status plus the new supersession
      table.
- [ ] Add failing engine tests for atomic supersession and read-back of the link
      record after reopen.
- [ ] Add failing service tests for:
  - staged candidate superseded by promoted replacement
  - promoted candidate superseded by promoted replacement
  - replacement candidate not promoted
  - cross-scope mismatch
  - self-supersession rejection
- [ ] Add failing operation tests for the new CLI surface.
- [ ] Add failing benchmark-shape and Phase 5 acceptance-pack expectations.
- [ ] Run the focused suite and confirm failure is due to the missing
      supersession feature.

## Task 2: Minimal Implementation

- [ ] Add the smallest type and schema changes:
  - `superseded` status
  - supersession entry types
  - migration for the link-record table
- [ ] Add dedicated engine support for:
  - compare-and-swap `supersedeMemoryCandidateEntry`
  - create/get supersession records
- [ ] Implement one supersession service that:
  - validates ids, scope, and replacement status
  - preserves atomicity for candidate status change plus record creation, either
    through `engine.transaction` or one dedicated atomic engine method
  - returns explicit old/new/record output
- [ ] Add one shared operation in `operations-memory-inbox.ts`.

## Task 3: Verification

- [ ] Add `phase5-memory-inbox-supersession` benchmark and wire it into
      `phase5-acceptance-pack`.
- [ ] Update `package.json` and `docs/MBRAIN_VERIFY.md`.
- [ ] Run focused tests.
- [ ] Run `bun run bench:phase5-memory-inbox-supersession --json`.
- [ ] Run `bun run bench:phase5-acceptance --json`.
- [ ] Run `bun run test:phase5`.

## Task 4: Critical Review Loop

- [ ] Run one subagent spec review on the completed slice.
- [ ] Fix only valid spec findings.
- [ ] Run one subagent code-quality review on the completed slice.
- [ ] Fix only valid quality findings.
- [ ] Re-run the focused verification after review fixes before committing.
