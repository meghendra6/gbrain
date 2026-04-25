import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { operations } from '../src/core/operations.ts';
import { SQLiteEngine } from '../src/core/sqlite-engine.ts';

async function createSqliteHarness(label: string): Promise<{
  engine: SQLiteEngine;
  cleanup: () => Promise<void>;
}> {
  const dir = mkdtempSync(join(tmpdir(), `mbrain-memory-realm-${label}-`));
  const engine = new SQLiteEngine();
  await engine.connect({ engine: 'sqlite', database_path: join(dir, 'brain.db') });
  await engine.initSchema();
  return {
    engine,
    cleanup: async () => {
      await engine.disconnect().catch(() => undefined);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function getOperation(name: string) {
  const operation = operations.find((entry) => entry.name === name);
  if (!operation) throw new Error(`Operation not found: ${name}`);
  return operation;
}

describe('memory realms engine', () => {
  test('SQLite upserts and lists active realms by scope', async () => {
    const harness = await createSqliteHarness('engine');
    try {
      const work = await harness.engine.upsertMemoryRealm({
        id: 'realm:work',
        name: 'Work Realm',
        scope: 'work',
      });
      await harness.engine.upsertMemoryRealm({
        id: 'realm:personal',
        name: 'Personal Realm',
        scope: 'personal',
        default_access: 'read_write',
      });
      await harness.engine.upsertMemoryRealm({
        id: 'realm:archived-work',
        name: 'Archived Work Realm',
        scope: 'work',
        archived_at: '2026-04-25T01:00:00.000Z',
      });

      expect(work).toMatchObject({
        id: 'realm:work',
        name: 'Work Realm',
        description: '',
        scope: 'work',
        default_access: 'read_only',
        retention_policy: 'retain',
        export_policy: 'private',
        agent_instructions: '',
        archived_at: null,
      });
      expect(work.created_at).toBeInstanceOf(Date);
      expect(work.updated_at).toBeInstanceOf(Date);

      expect((await harness.engine.getMemoryRealm('realm:work'))?.id).toBe('realm:work');
      expect(await harness.engine.getMemoryRealm('realm:missing')).toBeNull();
      expect((await harness.engine.listMemoryRealms({ scope: 'work' })).map((realm) => realm.id)).toEqual([
        'realm:work',
      ]);
      expect((await harness.engine.listMemoryRealms({
        scope: 'work',
        include_archived: true,
      })).map((realm) => realm.id).sort()).toEqual([
        'realm:archived-work',
        'realm:work',
      ]);
      expect((await harness.engine.listMemoryRealms({ scope: 'personal' })).map((realm) => realm.id)).toEqual([
        'realm:personal',
      ]);
    } finally {
      await harness.cleanup();
    }
  });
});

describe('memory realm operations', () => {
  test('upsert_memory_realm respects dry-run and validates enum fields', async () => {
    const harness = await createSqliteHarness('operations');
    try {
      const upsert = getOperation('upsert_memory_realm');
      const list = getOperation('list_memory_realms');

      const preview = await upsert.handler({
        engine: harness.engine,
        config: { engine: 'sqlite' },
        dryRun: true,
      } as any, {
        id: 'realm:dry-run',
        name: 'Dry Run Realm',
        scope: 'work',
      });
      expect(preview).toMatchObject({
        action: 'upsert_memory_realm',
        dry_run: true,
        realm: {
          id: 'realm:dry-run',
          name: 'Dry Run Realm',
          scope: 'work',
          default_access: 'read_only',
        },
      });
      expect(await harness.engine.getMemoryRealm('realm:dry-run')).toBeNull();

      await expect(upsert.handler({
        engine: harness.engine,
        config: { engine: 'sqlite' },
        dryRun: false,
      } as any, {
        id: 'realm:invalid-scope',
        name: 'Invalid Scope Realm',
        scope: 'outside',
      })).rejects.toThrow(/scope/i);

      const created = await upsert.handler({
        engine: harness.engine,
        config: { engine: 'sqlite' },
        dryRun: false,
      } as any, {
        id: 'realm:operation',
        name: 'Operation Realm',
        scope: 'mixed',
        default_access: 'read_write',
      });
      expect(created).toMatchObject({
        id: 'realm:operation',
        scope: 'mixed',
        default_access: 'read_write',
      });

      const listed = await list.handler({
        engine: harness.engine,
        config: { engine: 'sqlite' },
        dryRun: false,
      } as any, {
        scope: 'mixed',
      });
      expect(listed).toMatchObject([
        {
          id: 'realm:operation',
          scope: 'mixed',
        },
      ]);
    } finally {
      await harness.cleanup();
    }
  });
});
