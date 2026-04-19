import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'bun';

describe('phase0 baseline runner', () => {
  test('--help prints usage', () => {
    const proc = spawnSync(['bun', 'run', 'scripts/bench/phase0-baseline.ts', '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(proc.exitCode).toBe(0);
    expect(new TextDecoder().decode(proc.stdout)).toContain('Usage: bun run scripts/bench/phase0-baseline.ts');
  });

  test('--json prints a baseline report shape', () => {
    const proc = spawnSync(['bun', 'run', 'scripts/bench/phase0-baseline.ts', '--json'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(proc.exitCode).toBe(0);
    const payload = JSON.parse(new TextDecoder().decode(proc.stdout));
    expect(payload).toHaveProperty('generated_at');
    expect(payload).toHaveProperty('engine');
    expect(Array.isArray(payload.workloads)).toBe(true);
    expect(payload.workloads.some((w: any) => w.name === 'task_resume' && w.status === 'unsupported')).toBe(true);
  });
});
