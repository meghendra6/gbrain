import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { operations } from '../src/core/operations.ts';
import { SQLiteEngine } from '../src/core/sqlite-engine.ts';
import { importFromContent } from '../src/core/import-file.ts';

test('retrieval route selector operation is registered with CLI hints', () => {
  const route = operations.find((operation) => operation.name === 'select_retrieval_route');
  expect(route?.cliHints?.name).toBe('retrieval-route');
});

test('retrieval route selector operation dispatches task and precision intents', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mbrain-route-selector-op-'));
  const databasePath = join(dir, 'brain.db');
  const engine = new SQLiteEngine();
  const route = operations.find((operation) => operation.name === 'select_retrieval_route');

  if (!route) {
    throw new Error('select_retrieval_route operation is missing');
  }

  try {
    await engine.connect({ engine: 'sqlite', database_path: databasePath });
    await engine.initSchema();

    await engine.createTaskThread({
      id: 'task-1',
      scope: 'work',
      title: 'Phase 3 selector',
      goal: 'Unify route dispatch',
      status: 'active',
      repo_path: '/repo',
      branch_name: 'phase2-note-manifest',
      current_summary: 'Need one selector surface',
    });

    const taskResult = await route.handler({
      engine,
      config: {} as any,
      logger: console,
      dryRun: false,
    }, {
      intent: 'task_resume',
      task_id: 'task-1',
    });

    expect((taskResult as any).selected_intent).toBe('task_resume');
    expect((taskResult as any).route?.route_kind).toBe('task_resume');

    await importFromContent(engine, 'systems/mbrain', [
      '---',
      'type: system',
      'title: MBrain',
      '---',
      '# Overview',
      'Coordinates structural extraction.',
    ].join('\n'), { path: 'systems/mbrain.md' });

    const exact = await route.handler({
      engine,
      config: {} as any,
      logger: console,
      dryRun: false,
    }, {
      intent: 'precision_lookup',
      slug: 'systems/mbrain',
    });

    expect((exact as any).selected_intent).toBe('precision_lookup');
    expect((exact as any).route?.route_kind).toBe('precision_lookup');

    const byPath = await route.handler({
      engine,
      config: {} as any,
      logger: console,
      dryRun: false,
    }, {
      intent: 'precision_lookup',
      path: 'systems/mbrain.md',
    });

    expect((byPath as any).selected_intent).toBe('precision_lookup');
    expect((byPath as any).selection_reason).toBe('direct_path_match');
  } finally {
    await engine.disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});
