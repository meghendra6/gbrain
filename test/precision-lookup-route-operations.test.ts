import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { operations } from '../src/core/operations.ts';
import { SQLiteEngine } from '../src/core/sqlite-engine.ts';
import { importFromContent } from '../src/core/import-file.ts';

test('precision lookup route operation is registered with CLI hints', () => {
  const route = operations.find((operation) => operation.name === 'get_precision_lookup_route');
  expect(route?.cliHints?.name).toBe('precision-lookup-route');
});

test('precision lookup route operation returns no-match disclosure and direct route payloads', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mbrain-precision-route-op-'));
  const databasePath = join(dir, 'brain.db');
  const engine = new SQLiteEngine();
  const route = operations.find((operation) => operation.name === 'get_precision_lookup_route');

  if (!route) {
    throw new Error('get_precision_lookup_route operation is missing');
  }

  try {
    await engine.connect({ engine: 'sqlite', database_path: databasePath });
    await engine.initSchema();

    const noMatch = await route.handler({
      engine,
      config: {} as any,
      logger: console,
      dryRun: false,
    }, {
      slug: 'systems/unknown',
    });

    expect((noMatch as any).selection_reason).toBe('no_match');
    expect((noMatch as any).route).toBeNull();

    await importFromContent(engine, 'systems/mbrain', [
      '---',
      'type: system',
      'title: MBrain',
      '---',
      '# Overview',
      'Coordinates structural extraction.',
    ].join('\n'), { path: 'systems/mbrain.md' });

    const direct = await route.handler({
      engine,
      config: {} as any,
      logger: console,
      dryRun: false,
    }, {
      slug: 'systems/mbrain',
    });

    expect((direct as any).selection_reason).toBe('direct_page_match');
    expect((direct as any).route?.route_kind).toBe('precision_lookup');
    expect((direct as any).route?.slug).toBe('systems/mbrain');
  } finally {
    await engine.disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});
