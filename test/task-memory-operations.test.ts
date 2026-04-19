import { expect, test } from 'bun:test';
import { formatResult, OperationError, operations } from '../src/core/operations.ts';

test('task operations are registered with CLI hints', () => {
  const start = operations.find((operation) => operation.name === 'start_task');
  const resume = operations.find((operation) => operation.name === 'resume_task');
  const refresh = operations.find((operation) => operation.name === 'refresh_task_working_set');
  const attempt = operations.find((operation) => operation.name === 'record_attempt');
  const decision = operations.find((operation) => operation.name === 'record_decision');

  expect(start?.cliHints?.name).toBe('task-start');
  expect(resume?.cliHints?.name).toBe('task-resume');
  expect(refresh?.cliHints?.name).toBe('task-working-set');
  expect(attempt?.cliHints?.name).toBe('task-attempt');
  expect(decision?.cliHints?.name).toBe('task-decision');
});

test('start_task seeds an empty working set', async () => {
  const calls: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const start = operations.find((operation) => operation.name === 'start_task');
  if (!start) throw new Error('start_task operation is missing');

  const transactionEngine = {
    createTaskThread: async (payload: Record<string, unknown>) => {
      calls.push({ type: 'thread', payload });
      return {
        ...payload,
        goal: payload.goal ?? '',
        current_summary: payload.current_summary ?? '',
        created_at: new Date(),
        updated_at: new Date(),
      };
    },
    upsertTaskWorkingSet: async (payload: Record<string, unknown>) => {
      calls.push({ type: 'working_set', payload });
      return {
        ...payload,
        last_verified_at: null,
        updated_at: new Date(),
      };
    },
    getTaskThread: async (id: string) => ({
      id,
      scope: 'work',
      title: 'Phase 1 MVP',
      goal: 'Ship operational memory',
      status: 'active',
      repo_path: process.cwd(),
      branch_name: null,
      current_summary: '',
      created_at: new Date(),
      updated_at: new Date(),
    }),
  };

  const result = await start.handler({
    engine: {
      transaction: async (fn: (engine: typeof transactionEngine) => Promise<unknown>) => {
        calls.push({ type: 'transaction', payload: {} });
        return fn(transactionEngine);
      },
    } as any,
    config: {} as any,
    logger: console,
    dryRun: false,
  }, {
    title: 'Phase 1 MVP',
    goal: 'Ship operational memory',
    scope: 'work',
  });

  expect(calls[0]?.type).toBe('transaction');
  expect(calls[1]?.type).toBe('thread');
  expect(calls[2]?.type).toBe('working_set');
  expect(calls[2]?.payload).toMatchObject({
    active_paths: [],
    active_symbols: [],
    blockers: [],
    open_questions: [],
    next_steps: [],
    verification_notes: [],
  });
  expect((result as any).title).toBe('Phase 1 MVP');
});

test('formatResult renders a resume card', () => {
  const output = formatResult('resume_task', {
    task_id: 'task-1',
    title: 'Phase 1 MVP',
    status: 'blocked',
    goal: 'Ship operational memory',
    current_summary: 'Schema and engine layers are done',
    active_paths: ['src/core/operations.ts'],
    active_symbols: ['operations'],
    blockers: ['task commands missing'],
    open_questions: ['should resume emit trace ids'],
    next_steps: ['add shared operations'],
    failed_attempts: ['CLI-only task path'],
    active_decisions: ['keep working set canonical in DB'],
    latest_trace_route: ['task_thread', 'working_set', 'attempts', 'decisions'],
    stale: true,
  });

  expect(output).toContain('Phase 1 MVP');
  expect(output).toContain('operations');
  expect(output).toContain('should resume emit trace ids');
  expect(output).toContain('CLI-only task path');
  expect(output).toContain('stale');
});

test('refresh_task_working_set updates freshness and preserves missing arrays', async () => {
  const refresh = operations.find((operation) => operation.name === 'refresh_task_working_set');
  if (!refresh) throw new Error('refresh_task_working_set operation is missing');

  let upsertPayload: Record<string, unknown> | undefined;
  const workingSet = await refresh.handler({
    engine: {
      getTaskThread: async () => ({
        id: 'task-1',
        scope: 'work',
        title: 'Phase 1 MVP',
        goal: 'Ship operational memory',
        status: 'active',
        repo_path: process.cwd(),
        branch_name: null,
        current_summary: 'Resume exists',
        created_at: new Date('2026-04-19T00:00:00.000Z'),
        updated_at: new Date('2026-04-19T00:00:00.000Z'),
      }),
      getTaskWorkingSet: async () => ({
        task_id: 'task-1',
        active_paths: ['src/core/operations.ts'],
        active_symbols: ['operations'],
        blockers: ['task commands missing'],
        open_questions: ['should resume emit trace ids'],
        next_steps: ['add shared operations'],
        verification_notes: ['schema verified'],
        last_verified_at: null,
        updated_at: new Date('2026-04-19T00:00:00.000Z'),
      }),
      upsertTaskWorkingSet: async (payload: Record<string, unknown>) => {
        upsertPayload = payload;
        return {
          ...payload,
          updated_at: new Date('2026-04-19T00:05:00.000Z'),
        };
      },
    } as any,
    config: {} as any,
    logger: console,
    dryRun: false,
  }, {
    task_id: 'task-1',
    verification_notes: ['resume verified against current branch'],
  });

  expect(upsertPayload).toMatchObject({
    task_id: 'task-1',
    active_paths: ['src/core/operations.ts'],
    active_symbols: ['operations'],
    blockers: ['task commands missing'],
    open_questions: ['should resume emit trace ids'],
    next_steps: ['add shared operations'],
    verification_notes: ['resume verified against current branch'],
  });
  expect(upsertPayload?.last_verified_at).toBeInstanceOf(Date);
  expect((workingSet as any).last_verified_at).toBeInstanceOf(Date);
});

test('task mutation operations reject unknown task ids with a stable error', async () => {
  const refresh = operations.find((operation) => operation.name === 'refresh_task_working_set');
  const attempt = operations.find((operation) => operation.name === 'record_attempt');
  const decision = operations.find((operation) => operation.name === 'record_decision');
  if (!refresh || !attempt || !decision) throw new Error('task mutation operations are missing');

  const ctx = {
    engine: {
      getTaskThread: async () => null,
    } as any,
    config: {} as any,
    logger: console,
    dryRun: false,
  };

  await expect(refresh.handler(ctx, { task_id: 'missing-task' })).rejects.toBeInstanceOf(OperationError);
  await expect(attempt.handler(ctx, {
    task_id: 'missing-task',
    summary: 'Tried an unknown task',
    outcome: 'failed',
  })).rejects.toMatchObject({ code: 'task_not_found' });
  await expect(decision.handler(ctx, {
    task_id: 'missing-task',
    summary: 'Decided on an unknown task',
    rationale: 'Should be rejected before persistence',
  })).rejects.toMatchObject({ code: 'task_not_found' });
});
