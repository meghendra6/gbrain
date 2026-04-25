import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { operations } from '../src/core/operations.ts';
import type { Operation, OperationContext } from '../src/core/operations.ts';
import { SQLiteEngine } from '../src/core/sqlite-engine.ts';

async function createSqliteHarness(label: string): Promise<{
  engine: SQLiteEngine;
  ctx: (dryRun?: boolean) => OperationContext;
  cleanup: () => Promise<void>;
}> {
  const dir = mkdtempSync(join(tmpdir(), `mbrain-memory-session-${label}-`));
  const engine = new SQLiteEngine();
  await engine.connect({ engine: 'sqlite', database_path: join(dir, 'brain.db') });
  await engine.initSchema();
  return {
    engine,
    ctx: (dryRun = false) => ({
      engine,
      config: { engine: 'sqlite', database_path: join(dir, 'brain.db') },
      logger: console,
      dryRun,
    } as unknown as OperationContext),
    cleanup: async () => {
      await engine.disconnect().catch(() => undefined);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function getOperation(name: string): Operation {
  const operation = operations.find((candidate) => candidate.name === name);
  if (!operation) throw new Error(`Operation not found: ${name}`);
  return operation;
}

describe('memory session attachment operations', () => {
  test('register session and attachment operations with useful schemas', () => {
    const create = getOperation('create_memory_session');
    const close = getOperation('close_memory_session');
    const attach = getOperation('attach_memory_realm_to_session');
    const list = getOperation('list_memory_session_attachments');

    expect(create.mutating).toBe(true);
    expect(create.params.id.required).toBe(true);
    expect(create.params.task_id.nullable).toBe(true);
    expect(create.params.actor_ref.nullable).toBe(true);

    expect(close.mutating).toBe(true);
    expect(close.params.id.required).toBe(true);

    expect(attach.mutating).toBe(true);
    expect(attach.params.session_id.required).toBe(true);
    expect(attach.params.realm_id.required).toBe(true);
    expect(attach.params.access.required).toBe(true);
    expect(attach.params.access.enum).toEqual(['read_only', 'read_write']);

    expect(list.mutating).toBe(false);
    expect(list.params.limit.default).toBe(100);
    expect(list.params.offset.default).toBe(0);
  });

  test('creates a session, attaches a realm read-only, lists attachments, and closes the session', async () => {
    const harness = await createSqliteHarness('operation-flow');
    try {
      const upsertRealm = getOperation('upsert_memory_realm');
      const createSession = getOperation('create_memory_session');
      const attachRealm = getOperation('attach_memory_realm_to_session');
      const listAttachments = getOperation('list_memory_session_attachments');
      const closeSession = getOperation('close_memory_session');

      await upsertRealm.handler(harness.ctx(), {
        id: 'realm:session-flow',
        name: 'Session Flow Realm',
        scope: 'work',
        default_access: 'read_only',
      });

      const created = await createSession.handler(harness.ctx(), {
        id: 'session-flow',
        task_id: 'task-flow',
        actor_ref: 'agent:test',
      }) as any;
      expect(created).toMatchObject({
        id: 'session-flow',
        task_id: 'task-flow',
        status: 'active',
        actor_ref: 'agent:test',
        closed_at: null,
      });
      expect(created.created_at).toBeInstanceOf(Date);

      const attachment = await attachRealm.handler(harness.ctx(), {
        session_id: 'session-flow',
        realm_id: 'realm:session-flow',
        access: 'read_only',
        instructions: 'Use this realm as read-only context for the task.',
      }) as any;
      expect(attachment).toMatchObject({
        session_id: 'session-flow',
        realm_id: 'realm:session-flow',
        access: 'read_only',
        instructions: 'Use this realm as read-only context for the task.',
      });
      expect(attachment.attached_at).toBeInstanceOf(Date);

      const bySession = await listAttachments.handler(harness.ctx(), {
        session_id: 'session-flow',
      }) as any[];
      expect(bySession).toHaveLength(1);
      expect(bySession[0]).toMatchObject({
        session_id: 'session-flow',
        realm_id: 'realm:session-flow',
        access: 'read_only',
      });

      const byRealm = await listAttachments.handler(harness.ctx(), {
        realm_id: 'realm:session-flow',
      }) as any[];
      expect(byRealm.map((entry) => entry.session_id)).toEqual(['session-flow']);

      const closed = await closeSession.handler(harness.ctx(), {
        id: 'session-flow',
      }) as any;
      expect(closed).toMatchObject({
        id: 'session-flow',
        status: 'closed',
      });
      expect(closed.closed_at).toBeInstanceOf(Date);

      const events = await harness.engine.listMemoryMutationEvents({
        session_id: 'session-flow',
        limit: 10,
      });
      const eventsByOperation = new Map(events.map((event) => [event.operation, event]));
      expect([...eventsByOperation.keys()].sort()).toEqual([
        'attach_memory_realm_to_session',
        'close_memory_session',
        'create_memory_session',
      ]);

      expect(eventsByOperation.get('create_memory_session')).toMatchObject({
        session_id: 'session-flow',
        realm_id: 'session:session-flow',
        operation: 'create_memory_session',
        target_kind: 'memory_session',
        target_id: 'session-flow',
        result: 'applied',
        dry_run: false,
      });
      expect(eventsByOperation.get('create_memory_session')?.source_refs).toEqual([
        'Source: mbrain create_memory_session operation',
      ]);

      expect(eventsByOperation.get('attach_memory_realm_to_session')).toMatchObject({
        session_id: 'session-flow',
        realm_id: 'realm:session-flow',
        operation: 'attach_memory_realm_to_session',
        target_kind: 'memory_session_attachment',
        target_id: 'session-flow:realm:session-flow',
        result: 'applied',
        dry_run: false,
        metadata: {
          access: 'read_only',
        },
      });
      expect(eventsByOperation.get('attach_memory_realm_to_session')?.source_refs).toEqual([
        'Source: mbrain attach_memory_realm_to_session operation',
      ]);

      expect(eventsByOperation.get('close_memory_session')).toMatchObject({
        session_id: 'session-flow',
        realm_id: 'session:session-flow',
        operation: 'close_memory_session',
        target_kind: 'memory_session',
        target_id: 'session-flow',
        result: 'applied',
        dry_run: false,
      });
      expect(eventsByOperation.get('close_memory_session')?.source_refs).toEqual([
        'Source: mbrain close_memory_session operation',
      ]);
    } finally {
      await harness.cleanup();
    }
  });

  test('mutating session and attachment operations respect dry-run without writing ledger events', async () => {
    const harness = await createSqliteHarness('dry-run');
    try {
      const upsertRealm = getOperation('upsert_memory_realm');
      const createSession = getOperation('create_memory_session');
      const attachRealm = getOperation('attach_memory_realm_to_session');
      const listAttachments = getOperation('list_memory_session_attachments');
      const closeSession = getOperation('close_memory_session');

      await upsertRealm.handler(harness.ctx(), {
        id: 'realm:dry-run',
        name: 'Dry Run Realm',
        scope: 'work',
      });

      const dryCreate = await createSession.handler(harness.ctx(true), {
        id: 'session-dry-create',
        task_id: 'task-dry',
      }) as any;
      expect(dryCreate).toMatchObject({
        action: 'create_memory_session',
        dry_run: true,
        session: {
          id: 'session-dry-create',
          task_id: 'task-dry',
          status: 'active',
        },
      });

      await expect(attachRealm.handler(harness.ctx(), {
        session_id: 'session-dry-create',
        realm_id: 'realm:dry-run',
        access: 'read_only',
      })).rejects.toThrow();

      await createSession.handler(harness.ctx(), {
        id: 'session-dry-existing',
      });

      const dryAttach = await attachRealm.handler(harness.ctx(true), {
        session_id: 'session-dry-existing',
        realm_id: 'realm:dry-run',
        access: 'read_write',
        instructions: 'Dry-run attachment only.',
      }) as any;
      expect(dryAttach).toMatchObject({
        action: 'attach_memory_realm_to_session',
        dry_run: true,
        attachment: {
          session_id: 'session-dry-existing',
          realm_id: 'realm:dry-run',
          access: 'read_write',
          instructions: 'Dry-run attachment only.',
        },
      });

      expect(await listAttachments.handler(harness.ctx(), {
        session_id: 'session-dry-existing',
      })).toEqual([]);

      const dryClose = await closeSession.handler(harness.ctx(true), {
        id: 'session-dry-existing',
      }) as any;
      expect(dryClose).toMatchObject({
        action: 'close_memory_session',
        dry_run: true,
        session: {
          id: 'session-dry-existing',
          status: 'closed',
        },
      });
      const activeAfterDryClose = await (harness.engine as any).getMemorySession('session-dry-existing');
      expect(activeAfterDryClose).toMatchObject({
        id: 'session-dry-existing',
        status: 'active',
        closed_at: null,
      });

      await closeSession.handler(harness.ctx(), {
        id: 'session-dry-existing',
      });

      const dryRunTargetIds = [
        'session-dry-create',
        'session-dry-existing:realm:dry-run',
      ];
      for (const target_id of dryRunTargetIds) {
        expect(await harness.engine.listMemoryMutationEvents({
          target_id,
          result: 'dry_run',
        })).toEqual([]);
      }
      expect(await harness.engine.listMemoryMutationEvents({
        operation: 'attach_memory_realm_to_session' as any,
        target_id: 'session-dry-existing:realm:dry-run',
      })).toEqual([]);
      expect(await harness.engine.listMemoryMutationEvents({
        operation: 'close_memory_session' as any,
        target_id: 'session-dry-existing',
      })).toHaveLength(1);
    } finally {
      await harness.cleanup();
    }
  });
});
