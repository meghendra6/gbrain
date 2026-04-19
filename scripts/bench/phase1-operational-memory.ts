#!/usr/bin/env bun

import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { performance } from 'perf_hooks';
import { createLocalConfigDefaults } from '../../src/core/config.ts';
import { createConnectedEngine } from '../../src/core/engine-factory.ts';
import { buildTaskResumeCard } from '../../src/core/services/task-memory-service.ts';
import type { BrainEngine } from '../../src/core/engine.ts';
import {
  PHASE1_TASK_FIXTURES,
  PHASE1_WORKLOADS,
  type Phase1LatencyWorkloadName,
  type Phase1WorkloadResult,
} from './phase1-workloads.ts';

const args = new Set(process.argv.slice(2));

if (args.has('--help')) {
  console.log('Usage: bun run scripts/bench/phase1-operational-memory.ts [--json]');
  process.exit(0);
}

const jsonOutput = args.has('--json');
const tempDir = mkdtempSync(join(tmpdir(), 'mbrain-phase1-'));
const databasePath = join(tempDir, 'phase1.db');

let engine: BrainEngine | null = null;

try {
  const config = createLocalConfigDefaults({
    database_path: databasePath,
    embedding_provider: 'none',
    query_rewrite_provider: 'none',
  });

  engine = await createConnectedEngine(config);
  await engine.initSchema();
  await seedPhase1Fixtures(engine);

  const workloads: Phase1WorkloadResult[] = [];
  workloads.push(await runLatencyWorkload(engine, 'task_resume'));
  workloads.push(await runLatencyWorkload(engine, 'attempt_history'));
  workloads.push(await runLatencyWorkload(engine, 'decision_history'));
  workloads.push(await runResumeProjectionWorkload(engine));

  const payload = {
    generated_at: new Date().toISOString(),
    engine: config.engine,
    workloads,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`Phase 1 operational-memory benchmark complete for ${config.engine}`);
    console.log(JSON.stringify(payload, null, 2));
  }
} finally {
  if (engine) {
    await engine.disconnect();
  }
  rmSync(tempDir, { recursive: true, force: true });
}

async function seedPhase1Fixtures(engine: BrainEngine): Promise<void> {
  for (const fixture of PHASE1_TASK_FIXTURES) {
    await engine.createTaskThread(fixture.thread);
    await engine.upsertTaskWorkingSet({
      task_id: fixture.thread.id,
      active_paths: fixture.workingSet.active_paths,
      active_symbols: fixture.workingSet.active_symbols,
      blockers: fixture.workingSet.blockers,
      open_questions: fixture.workingSet.open_questions,
      next_steps: fixture.workingSet.next_steps,
      verification_notes: fixture.workingSet.verification_notes,
      last_verified_at: fixture.workingSet.last_verified_at,
    });

    for (const attempt of fixture.attempts) {
      await engine.recordTaskAttempt({
        ...attempt,
        task_id: fixture.thread.id,
      });
    }

    for (const decision of fixture.decisions) {
      await engine.recordTaskDecision({
        ...decision,
        task_id: fixture.thread.id,
      });
    }

    await engine.putRetrievalTrace({
      ...fixture.trace,
      task_id: fixture.thread.id,
      scope: fixture.thread.scope,
    });
  }
}

async function runLatencyWorkload(
  engine: BrainEngine,
  name: Phase1LatencyWorkloadName,
): Promise<Extract<Phase1WorkloadResult, { name: Phase1LatencyWorkloadName }>> {
  const definition = PHASE1_WORKLOADS.find((workload) => workload.name === name);
  const samples = definition?.samples ?? 5;
  const durations: number[] = [];

  for (let i = 0; i < samples; i++) {
    for (const fixture of PHASE1_TASK_FIXTURES) {
      const start = performance.now();
      if (name === 'task_resume') {
        await buildTaskResumeCard(engine, fixture.thread.id);
      } else if (name === 'attempt_history') {
        await engine.listTaskAttempts(fixture.thread.id, { limit: 10 });
      } else {
        await engine.listTaskDecisions(fixture.thread.id, { limit: 10 });
      }
      durations.push(performance.now() - start);
    }
  }

  return {
    name,
    status: 'measured',
    unit: 'ms',
    p50_ms: formatMeasuredMs(percentile(durations, 0.5)),
    p95_ms: formatMeasuredMs(percentile(durations, 0.95)),
  };
}

async function runResumeProjectionWorkload(
  engine: BrainEngine,
): Promise<Extract<Phase1WorkloadResult, { name: 'resume_projection' }>> {
  let passed = 0;

  for (const fixture of PHASE1_TASK_FIXTURES) {
    const resume = await buildTaskResumeCard(engine, fixture.thread.id);
    const matches =
      resume.stale === fixture.expectedResume.stale &&
      hasExactItems(resume.failed_attempts, fixture.expectedResume.failed_attempts) &&
      hasExactItems(resume.active_decisions, fixture.expectedResume.active_decisions) &&
      hasExactItems(resume.latest_trace_route, fixture.expectedResume.latest_trace_route);

    if (matches) {
      passed += 1;
    }
  }

  return {
    name: 'resume_projection',
    status: 'measured',
    unit: 'percent',
    success_rate: roundTo((passed / PHASE1_TASK_FIXTURES.length) * 100, 2),
  };
}

function hasExactItems(actual: string[], expected: string[]): boolean {
  if (actual.length !== expected.length) return false;
  return expected.every((entry, index) => actual[index] === entry);
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index] ?? 0;
}

function formatMeasuredMs(value: number): number {
  if (value <= 0) return 0;
  return Math.max(0.001, roundTo(value, 3));
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
