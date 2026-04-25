import { describe, expect, test } from 'bun:test';
import { planRetrievalRequest } from '../src/core/services/retrieval-request-planner-service.ts';

describe('retrieval request planner', () => {
  test('decomposes task resume plus synthesis into ordered steps', () => {
    const plan = planRetrievalRequest({
      allow_decomposition: true,
      intent: 'task_resume',
      task_id: 'task-123',
      requested_scope: 'work',
      query: 'Summarize what remains for this task',
    });

    expect(plan.selection_reason).toBe('decomposed_mixed_intent');
    expect(plan.steps.map((step) => step.intent)).toEqual(['task_resume', 'broad_synthesis']);
    expect(plan.steps[0]?.input.task_id).toBe('task-123');
    expect(plan.steps[1]?.input.query).toBe('Summarize what remains for this task');
  });

  test('does not decompose explicit non-task intents', () => {
    const plan = planRetrievalRequest({
      allow_decomposition: true,
      intent: 'precision_lookup',
      task_id: 'task-123',
      query: 'Summarize what remains for this task',
      slug: 'concepts/router',
    });

    expect(plan.selection_reason).toBe('single_intent');
    expect(plan.steps.map((step) => step.intent)).toEqual(['precision_lookup']);
  });

  test('infers precision lookup from an exact section id', () => {
    const plan = planRetrievalRequest({
      section_id: 'systems/mbrain#overview/runtime',
    });

    expect(plan.selection_reason).toBe('single_intent');
    expect(plan.steps.map((step) => step.intent)).toEqual(['precision_lookup']);
    expect(plan.steps[0]?.input.section_id).toBe('systems/mbrain#overview/runtime');
  });

  test('plans explicit mixed-scope bridge when requested scope is mixed', () => {
    const plan = planRetrievalRequest({
      allow_decomposition: true,
      requested_scope: 'mixed',
      query: 'Connect Alex personal context to work context',
      subject: 'alex',
      personal_route_kind: 'profile',
    });

    expect(plan.selection_reason).toBe('single_intent');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.intent).toBe('mixed_scope_bridge');
    expect(plan.steps[0]?.input.requested_scope).toBe('mixed');
  });

  test('returns no_match when there is not enough input to infer a route', () => {
    const plan = planRetrievalRequest({
      allow_decomposition: true,
    });

    expect(plan.selection_reason).toBe('no_match');
    expect(plan.steps).toEqual([]);
  });
});
