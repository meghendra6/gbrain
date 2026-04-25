import { describe, expect, test } from 'bun:test';
import { operationsByName } from '../src/core/operations.ts';

describe('plan_retrieval_request operation', () => {
  test('is registered with CLI hints', () => {
    const op = operationsByName.plan_retrieval_request;
    expect(op).toBeDefined();
    expect(op?.cliHints?.name).toBe('plan-retrieval-request');
    expect(op?.mutating).toBe(false);
  });

  test('returns a plan without reading the engine', async () => {
    const op = operationsByName.plan_retrieval_request;
    if (!op) {
      throw new Error('plan_retrieval_request operation is missing');
    }

    const result = await op.handler({
      engine: new Proxy({}, {
        get() {
          throw new Error('plan_retrieval_request must not read the engine');
        },
      }) as any,
      config: {} as any,
      logger: console,
      dryRun: false,
    }, {
      allow_decomposition: true,
      intent: 'task_resume',
      task_id: 'task-123',
      query: 'Summarize what remains for this task',
    });

    expect((result as { selection_reason: string }).selection_reason).toBe('decomposed_mixed_intent');
    expect((result as { steps: Array<{ intent: string }> }).steps.map((step) => step.intent)).toEqual([
      'task_resume',
      'broad_synthesis',
    ]);
  });

  test('rejects invalid enum params', async () => {
    const op = operationsByName.plan_retrieval_request;
    if (!op) {
      throw new Error('plan_retrieval_request operation is missing');
    }

    await expect(op.handler({
      engine: {} as any,
      config: {} as any,
      logger: console,
      dryRun: false,
    }, {
      intent: 'not_real',
    })).rejects.toThrow('intent must be one of');
  });
});
