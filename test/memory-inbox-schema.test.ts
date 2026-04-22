import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PGLiteEngine } from '../src/core/pglite-engine.ts';
import { SQLiteEngine } from '../src/core/sqlite-engine.ts';

describe('memory-inbox schema', () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    while (tempPaths.length > 0) {
      rmSync(tempPaths.pop()!, { recursive: true, force: true });
    }
  });

  test('sqlite initSchema creates memory candidate supersession schema', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mbrain-memory-inbox-sqlite-'));
    const databasePath = join(dir, 'brain.db');
    tempPaths.push(dir);

    const engine = new SQLiteEngine();
    await engine.connect({ engine: 'sqlite', database_path: databasePath });
    await engine.initSchema();

    const db = (engine as any).database;
    const rows = db
      .query(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table'
           AND name IN ('memory_candidate_entries', 'memory_candidate_supersession_entries')
         ORDER BY name ASC`,
      )
      .all() as Array<{ name: string }>;

    expect(rows.map((row) => row.name)).toEqual([
      'memory_candidate_entries',
      'memory_candidate_supersession_entries',
    ]);

    const schema = db
      .query(
        `SELECT sql
         FROM sqlite_master
         WHERE type = 'table'
           AND name = 'memory_candidate_entries'`,
      )
      .get() as { sql: string };

    expect(schema.sql).toContain("candidate_type TEXT NOT NULL CHECK");
    expect(schema.sql).toContain("generated_by TEXT NOT NULL CHECK");
    expect(schema.sql).toContain("extraction_kind TEXT NOT NULL CHECK");
    expect(schema.sql).toContain("sensitivity TEXT NOT NULL CHECK");
    expect(schema.sql).toContain("status TEXT NOT NULL CHECK");
    expect(schema.sql).toContain("target_object_type TEXT CHECK");

    expect(() => {
      db.query(`
        INSERT INTO memory_candidate_entries (
          id,
          scope_id,
          candidate_type,
          proposed_content,
          source_refs,
          generated_by,
          extraction_kind,
          confidence_score,
          importance_score,
          recurrence_score,
          sensitivity,
          status
        ) VALUES (
          'promoted-status',
          'workspace:default',
          'fact',
          'Promoted should be valid in the promotion slice.',
          '[]',
          'manual',
          'manual',
          0.5,
          0.5,
          0,
          'work',
          'promoted'
        )
      `).run();
    }).not.toThrow();

    expect(() => {
      db.query(`
        INSERT INTO memory_candidate_entries (
          id,
          scope_id,
          candidate_type,
          proposed_content,
          source_refs,
          generated_by,
          extraction_kind,
          confidence_score,
          importance_score,
          recurrence_score,
          sensitivity,
          status
        ) VALUES (
          'bad-status',
          'workspace:default',
          'fact',
          'Invalid status should fail at the DB layer.',
          '[]',
          'manual',
          'manual',
          0.5,
          0.5,
          0,
          'work',
          'superseded'
        )
      `).run();
    }).toThrow(/superseded candidate requires a supersession link record/);

    const supersessionSchema = db
      .query(
        `SELECT sql
         FROM sqlite_master
         WHERE type = 'table'
           AND name = 'memory_candidate_supersession_entries'`,
      )
      .get() as { sql: string };

    expect(supersessionSchema.sql).toContain("superseded_candidate_id TEXT NOT NULL");
    expect(supersessionSchema.sql).toContain("replacement_candidate_id TEXT NOT NULL");

    await engine.disconnect();
  });

  test('pglite initSchema creates memory candidate supersession schema', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mbrain-memory-inbox-pglite-'));
    tempPaths.push(dir);

    const engine = new PGLiteEngine();
    await engine.connect({ engine: 'pglite', database_path: dir });
    await engine.initSchema();

    const result = await (engine as any).db.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('memory_candidate_entries', 'memory_candidate_supersession_entries')
       ORDER BY table_name ASC`,
    );

    expect(result.rows.map((row: { table_name: string }) => row.table_name)).toEqual([
      'memory_candidate_entries',
      'memory_candidate_supersession_entries',
    ]);

    await expect((engine as any).db.query(`
      INSERT INTO memory_candidate_entries (
        id,
        scope_id,
        candidate_type,
        proposed_content,
        source_refs,
        generated_by,
        extraction_kind,
        confidence_score,
        importance_score,
        recurrence_score,
        sensitivity,
        status
      ) VALUES (
        'promoted-status',
        'workspace:default',
        'fact',
        'Promoted should be valid in the promotion slice.',
        '[]',
        'manual',
        'manual',
        0.5,
        0.5,
        0,
        'work',
        'promoted'
      )
    `)).resolves.toBeDefined();

    await expect((engine as any).db.query(`
      INSERT INTO memory_candidate_entries (
        id,
        scope_id,
        candidate_type,
        proposed_content,
        source_refs,
        generated_by,
        extraction_kind,
        confidence_score,
        importance_score,
        recurrence_score,
        sensitivity,
        status
      ) VALUES (
        'bad-status',
        'workspace:default',
        'fact',
        'Invalid status should fail at the DB layer.',
        '[]',
        'manual',
        'manual',
        0.5,
        0.5,
        0,
        'work',
        'superseded'
      )
    `)).rejects.toThrow(/superseded candidate requires a supersession link record/);

    const supersessionTables = await (engine as any).db.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'memory_candidate_supersession_entries'`,
    );

    expect(supersessionTables.rows.map((row: { table_name: string }) => row.table_name)).toEqual([
      'memory_candidate_supersession_entries',
    ]);

    await engine.disconnect();
  });
});
