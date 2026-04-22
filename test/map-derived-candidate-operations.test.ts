import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { importFromContent } from '../src/core/import-file.ts';
import { operations } from '../src/core/operations.ts';
import { SQLiteEngine } from '../src/core/sqlite-engine.ts';
import { buildStructuralContextMapEntry } from '../src/core/services/context-map-service.ts';
import { rebuildNoteManifestEntries } from '../src/core/services/note-manifest-service.ts';
import { rebuildNoteSectionEntries } from '../src/core/services/note-section-service.ts';

async function seedWorkspace(engine: SQLiteEngine, pageCount = 6, scopeId = 'workspace:default') {
  for (let index = 1; index <= pageCount; index += 1) {
    await importFromContent(engine, `concepts/topic-${index}`, [
      '---',
      'type: concept',
      `title: Topic ${index}`,
      '---',
      '# Overview',
      index < pageCount ? `See [[concepts/topic-${index + 1}]].` : 'Terminal node.',
    ].join('\n'), { path: `concepts/topic-${index}.md` });
  }

  if (scopeId !== 'workspace:default') {
    await rebuildNoteManifestEntries(engine, { scope_id: scopeId });
    await rebuildNoteSectionEntries(engine, { scope_id: scopeId });
  }
}

test('map-derived candidate operation is registered with CLI hints', () => {
  const capture = operations.find((operation) => operation.name === 'capture_map_derived_candidates');
  expect(capture?.cliHints?.name).toBe('capture-map-derived-candidates');
});

test('map-derived candidate operation defaults to the report read limit and honors smaller explicit limits', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mbrain-map-derived-op-'));
  const databasePath = join(dir, 'brain.db');
  const engine = new SQLiteEngine();
  const capture = operations.find((operation) => operation.name === 'capture_map_derived_candidates');

  if (!capture) {
    throw new Error('capture_map_derived_candidates operation is missing');
  }

  try {
    await engine.connect({ engine: 'sqlite', database_path: databasePath });
    await engine.initSchema();
    await seedWorkspace(engine, 6);
    const built = await buildStructuralContextMapEntry(engine);
    const before = await engine.getContextMapEntry(built.id);

    const defaultCaptured = await capture.handler({
      engine,
      config: {} as any,
      logger: console,
      dryRun: false,
    }, {
      map_id: built.id,
    });

    expect((defaultCaptured as any).candidates).toHaveLength(5);

    const bounded = await capture.handler({
      engine,
      config: {} as any,
      logger: console,
      dryRun: false,
    }, {
      map_id: built.id,
      limit: 2,
    });

    expect((bounded as any).candidates).toHaveLength(2);

    const after = await engine.getContextMapEntry(built.id);
    expect(after).toEqual(before);
  } finally {
    await engine.disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('map-derived candidate operation respects the selected map scope when map_id is provided without scope_id', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mbrain-map-derived-op-scope-'));
  const databasePath = join(dir, 'brain.db');
  const engine = new SQLiteEngine();
  const capture = operations.find((operation) => operation.name === 'capture_map_derived_candidates');
  const scopeId = 'workspace:project-beta';

  if (!capture) {
    throw new Error('capture_map_derived_candidates operation is missing');
  }

  try {
    await engine.connect({ engine: 'sqlite', database_path: databasePath });
    await engine.initSchema();
    await seedWorkspace(engine, 2, scopeId);
    const built = await buildStructuralContextMapEntry(engine, scopeId);

    const result = await capture.handler({
      engine,
      config: {} as any,
      logger: console,
      dryRun: false,
    }, {
      map_id: built.id,
      limit: 1,
    });

    expect((result as any).candidates).toHaveLength(1);
    expect((result as any).candidates[0]?.scope_id).toBe(scopeId);
  } finally {
    await engine.disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('map-derived candidate operation dry-run previews the selected map scope for direct map reads', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mbrain-map-derived-op-dry-run-scope-'));
  const databasePath = join(dir, 'brain.db');
  const engine = new SQLiteEngine();
  const capture = operations.find((operation) => operation.name === 'capture_map_derived_candidates');
  const scopeId = 'workspace:project-gamma';

  if (!capture) {
    throw new Error('capture_map_derived_candidates operation is missing');
  }

  try {
    await engine.connect({ engine: 'sqlite', database_path: databasePath });
    await engine.initSchema();
    await seedWorkspace(engine, 2, scopeId);
    const built = await buildStructuralContextMapEntry(engine, scopeId);

    const preview = await capture.handler({
      engine,
      config: {} as any,
      logger: console,
      dryRun: true,
    }, {
      map_id: built.id,
      limit: 1,
    });

    expect((preview as any).dry_run).toBe(true);
    expect((preview as any).scope_id).toBe(scopeId);
  } finally {
    await engine.disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});
