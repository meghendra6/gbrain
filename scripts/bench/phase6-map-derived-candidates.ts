#!/usr/bin/env bun

import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { importFromContent } from '../../src/core/import-file.ts';
import { SQLiteEngine } from '../../src/core/sqlite-engine.ts';
import { buildStructuralContextMapEntry } from '../../src/core/services/context-map-service.ts';
import { captureMapDerivedCandidates } from '../../src/core/services/map-derived-candidate-service.ts';
import { rebuildNoteManifestEntries } from '../../src/core/services/note-manifest-service.ts';
import { rebuildNoteSectionEntries } from '../../src/core/services/note-section-service.ts';

type Phase6MapDerivedCandidatesWorkloadResult =
  | {
      name: 'map_derived_candidates';
      status: 'measured';
      unit: 'ms';
      p50_ms: number;
      p95_ms: number;
    }
  | {
      name: 'map_derived_candidates_correctness';
      status: 'measured';
      unit: 'percent';
      success_rate: number;
    };

interface Phase6MapDerivedCandidatesAcceptanceCheck {
  name:
    | 'map_derived_candidates_p95_ms'
    | 'map_derived_candidates_correctness_success_rate';
  status: 'pass' | 'fail';
  actual: number;
  threshold: {
    operator: '<=' | '===';
    value: number;
    unit: 'ms' | 'percent';
  };
}

const THRESHOLDS = {
  map_derived_candidates_p95_ms_max: 150,
  map_derived_candidates_correctness_success_rate: 100,
} as const;

const SAMPLE_COUNT = 5;
const args = new Set(process.argv.slice(2));

if (args.has('--help')) {
  console.log('Usage: bun run scripts/bench/phase6-map-derived-candidates.ts [--json]');
  process.exit(0);
}

const tempDir = mkdtempSync(join(tmpdir(), 'mbrain-phase6-map-derived-candidates-'));
const databasePath = join(tempDir, 'phase6-map-derived-candidates.db');
const engine = new SQLiteEngine();

try {
  await engine.connect({ engine: 'sqlite', database_path: databasePath });
  await engine.initSchema();

  const workloads: Phase6MapDerivedCandidatesWorkloadResult[] = [
    await runCorrectnessWorkload(engine),
    await runLatencyWorkload(engine),
  ];

  const payload = {
    generated_at: new Date().toISOString(),
    engine: 'sqlite',
    phase: 'phase6',
    workloads,
    acceptance: evaluateAcceptance(workloads),
  };

  console.log(JSON.stringify(payload, null, 2));
} finally {
  await engine.disconnect();
  rmSync(tempDir, { recursive: true, force: true });
}

async function runCorrectnessWorkload(
  engine: SQLiteEngine,
): Promise<Extract<Phase6MapDerivedCandidatesWorkloadResult, { name: 'map_derived_candidates_correctness' }>> {
  let checks = 0;
  let passes = 0;

  await seedWorkspace(engine, 2);
  const readyMap = await buildStructuralContextMapEntry(engine);
  const ready = await captureMapDerivedCandidates(engine, {
    map_id: readyMap.id,
    limit: 1,
  });
  checks += 1;
  if (ready.map_status === 'ready'
    && ready.candidates[0]?.generated_by === 'map_analysis'
    && ready.candidates[0]?.extraction_kind === 'inferred') {
    passes += 1;
  }

  await importFromContent(engine, 'concepts/topic-2', [
    '---',
    'type: concept',
    'title: Topic 2',
    '---',
    '# Overview',
    'Topic 2 changed and makes the map stale.',
  ].join('\n'), { path: 'concepts/topic-2.md' });
  const stale = await captureMapDerivedCandidates(engine, {
    map_id: readyMap.id,
    limit: 1,
  });
  checks += 1;
  if (stale.map_status === 'stale'
    && stale.candidates[0]?.generated_by === 'map_analysis'
    && stale.candidates[0]?.extraction_kind === 'ambiguous'
    && stale.candidates[0]?.confidence_score === 0.35) {
    passes += 1;
  }

  return {
    name: 'map_derived_candidates_correctness',
    status: 'measured',
    unit: 'percent',
    success_rate: formatPercent((passes / checks) * 100),
  };
}

async function runLatencyWorkload(
  engine: SQLiteEngine,
): Promise<Extract<Phase6MapDerivedCandidatesWorkloadResult, { name: 'map_derived_candidates' }>> {
  const durations: number[] = [];

  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    const scopeId = `workspace:phase6:${sample}`;
    await seedWorkspace(engine, 2, scopeId);
    const built = await buildStructuralContextMapEntry(engine, scopeId);

    const start = performance.now();
    await captureMapDerivedCandidates(engine, {
      map_id: built.id,
      scope_id: scopeId,
      limit: 2,
    });
    durations.push(performance.now() - start);
  }

  return {
    name: 'map_derived_candidates',
    status: 'measured',
    unit: 'ms',
    p50_ms: formatMeasuredMs(percentile(durations, 0.5)),
    p95_ms: formatMeasuredMs(percentile(durations, 0.95)),
  };
}

async function seedWorkspace(engine: SQLiteEngine, pageCount = 2, scopeId = 'workspace:default') {
  for (let index = 1; index <= pageCount; index += 1) {
    await importFromContent(engine, `concepts/topic-${index}`, [
      '---',
      'type: concept',
      `title: Topic ${index}`,
      '---',
      '# Overview',
      index < pageCount ? `See [[concepts/topic-${index + 1}]].` : 'Terminal node.',
    ].join('\n'), {
      path: `concepts/topic-${index}.md`,
    });
  }

  if (scopeId !== 'workspace:default') {
    await rebuildNoteManifestEntries(engine, { scope_id: scopeId });
    await rebuildNoteSectionEntries(engine, { scope_id: scopeId });
  }
}

function evaluateAcceptance(workloads: Phase6MapDerivedCandidatesWorkloadResult[]) {
  const latency = workloads.find((workload) => workload.name === 'map_derived_candidates');
  const correctness = workloads.find((workload) => workload.name === 'map_derived_candidates_correctness');
  if (!latency || !correctness) {
    throw new Error('Missing map-derived-candidates benchmark workloads');
  }

  const checks: Phase6MapDerivedCandidatesAcceptanceCheck[] = [
    {
      name: 'map_derived_candidates_p95_ms',
      status: latency.p95_ms <= THRESHOLDS.map_derived_candidates_p95_ms_max ? 'pass' : 'fail',
      actual: latency.p95_ms,
      threshold: {
        operator: '<=',
        value: THRESHOLDS.map_derived_candidates_p95_ms_max,
        unit: 'ms',
      },
    },
    {
      name: 'map_derived_candidates_correctness_success_rate',
      status: correctness.success_rate === THRESHOLDS.map_derived_candidates_correctness_success_rate ? 'pass' : 'fail',
      actual: correctness.success_rate,
      threshold: {
        operator: '===',
        value: THRESHOLDS.map_derived_candidates_correctness_success_rate,
        unit: 'percent',
      },
    },
  ];

  const allPass = checks.every((check) => check.status === 'pass');
  return {
    readiness_status: allPass ? 'pass' : 'fail',
    phase6_status: allPass ? 'pass' : 'fail',
    summary: allPass
      ? 'Phase 6 map-derived candidate bridge passed for bounded inbox capture.'
      : 'Phase 6 map-derived candidate bridge failed because one or more checks missed the threshold.',
    checks,
  };
}

function percentile(values: number[], percentileValue: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1));
  return sorted[index] ?? 0;
}

function formatMeasuredMs(value: number): number {
  return Number(value.toFixed(3));
}

function formatPercent(value: number): number {
  return Number(value.toFixed(2));
}
