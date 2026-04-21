# Phase 3 Precision Lookup Path Design

## Goal

Extend the published note-corpus precision lookup route so callers can resolve an
exact canonical artifact by repo-relative Markdown path, not only by slug or
section id.

## Scope

- exact note-manifest path match only
- additive extension to `precision-lookup-route`
- reuse existing manifest pagination rather than new engine filters

## Non-Goals

- fuzzy path lookup
- raw source-record routing outside note manifest
- path filtering at the engine contract level

## Acceptance

- service resolves an exact canonical page by `path`
- operation exposes the same behavior
- benchmark still passes and now covers the path case
