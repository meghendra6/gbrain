import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'bun';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('phase7 acceptance-pack benchmark', () => {
  test('--json prints a phase7 acceptance summary shape', () => {
    const proc = spawnSync(['bun', 'run', 'scripts/bench/phase7-acceptance-pack.ts', '--json'], {
      cwd: repoRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(proc.exitCode).toBe(0);
    const payload = JSON.parse(new TextDecoder().decode(proc.stdout));

    expect(payload.phase).toBe('phase7');
    expect(Array.isArray(payload.benchmarks)).toBe(true);
    expect(payload.benchmarks.map((benchmark: any) => benchmark.name)).toEqual([
      'canonical_handoff',
    ]);
    expect(payload.acceptance.readiness_status).toBe('pass');
    expect(payload.acceptance.phase7_status).toBe('pass');
  });
});
