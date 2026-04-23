#!/usr/bin/env bun

import { spawnSync } from 'bun';

interface Phase7BenchmarkSummary {
  name: string;
  readiness_status: 'pass' | 'fail';
  phase7_status: 'pass' | 'fail';
}

const BENCHMARKS = [
  { name: 'canonical_handoff', path: 'scripts/bench/phase7-canonical-handoff.ts' },
  { name: 'historical_validity', path: 'scripts/bench/phase7-historical-validity.ts' },
] as const;

const args = new Set(process.argv.slice(2));

if (args.has('--help')) {
  console.log('Usage: bun run scripts/bench/phase7-acceptance-pack.ts [--json]');
  process.exit(0);
}

const summaries = BENCHMARKS.map(runBenchmark);
const allPass = summaries.every((item) => item.readiness_status === 'pass' && item.phase7_status === 'pass');

const payload = {
  generated_at: new Date().toISOString(),
  engine: 'sqlite',
  phase: 'phase7',
  benchmarks: summaries,
  acceptance: {
    readiness_status: allPass ? 'pass' : 'fail',
    phase7_status: allPass ? 'pass' : 'fail',
    summary: allPass
      ? 'Phase 7 acceptance pack passed across all published benchmark slices.'
      : 'Phase 7 acceptance pack failed because one or more benchmark slices failed.',
  },
};

console.log(JSON.stringify(payload, null, 2));

if (!allPass) {
  process.exit(1);
}

function runBenchmark(benchmark: typeof BENCHMARKS[number]): Phase7BenchmarkSummary {
  const proc = spawnSync(['bun', 'run', benchmark.path, '--json'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (proc.exitCode !== 0) {
    return {
      name: benchmark.name,
      readiness_status: 'fail',
      phase7_status: 'fail',
    };
  }

  const stdout = new TextDecoder().decode(proc.stdout);
  const parsed = JSON.parse(stdout);
  const acceptance = parsed?.acceptance ?? {};
  const readinessStatus = acceptance.readiness_status === 'pass' ? 'pass' : 'fail';
  const phase7Status = acceptance.phase7_status === 'pass' ? 'pass' : 'fail';

  return {
    name: benchmark.name,
    readiness_status: readinessStatus,
    phase7_status: phase7Status,
  };
}
