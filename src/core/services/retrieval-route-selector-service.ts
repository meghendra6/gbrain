import type { BrainEngine } from '../engine.ts';
import type {
  BroadSynthesisRoute,
  PrecisionLookupRoute,
  RetrievalRouteSelection,
  RetrievalRouteSelectorInput,
  RetrievalRouteSelectorResult,
} from '../types.ts';
import { getBroadSynthesisRoute } from './broad-synthesis-route-service.ts';
import { getPrecisionLookupRoute } from './precision-lookup-route-service.ts';
import { buildTaskResumeCard, type TaskResumeCard } from './task-memory-service.ts';

export async function selectRetrievalRoute(
  engine: BrainEngine,
  input: RetrievalRouteSelectorInput,
): Promise<RetrievalRouteSelectorResult> {
  switch (input.intent) {
    case 'task_resume':
      return selectTaskResumeRoute(engine, input.task_id);
    case 'broad_synthesis':
      return selectBroadSynthesisRoute(engine, input);
    case 'precision_lookup':
      return selectPrecisionLookupRoute(engine, input);
  }
}

async function selectTaskResumeRoute(
  engine: BrainEngine,
  taskId: string | undefined,
): Promise<RetrievalRouteSelectorResult> {
  if (!taskId) {
    return {
      selected_intent: 'task_resume',
      selection_reason: 'no_match',
      candidate_count: 0,
      route: null,
    };
  }

  const thread = await engine.getTaskThread(taskId);
  if (!thread) {
    return {
      selected_intent: 'task_resume',
      selection_reason: 'task_not_found',
      candidate_count: 0,
      route: null,
    };
  }

  const card = await buildTaskResumeCard(engine, taskId);
  return {
    selected_intent: 'task_resume',
    selection_reason: 'direct_task_match',
    candidate_count: 1,
    route: buildTaskResumeSelection(card),
  };
}

async function selectBroadSynthesisRoute(
  engine: BrainEngine,
  input: RetrievalRouteSelectorInput,
): Promise<RetrievalRouteSelectorResult> {
  const result = await getBroadSynthesisRoute(engine, {
    map_id: input.map_id,
    scope_id: input.scope_id,
    kind: input.kind,
    query: input.query ?? '',
    limit: input.limit,
  });
  return {
    selected_intent: 'broad_synthesis',
    selection_reason: result.selection_reason,
    candidate_count: result.candidate_count,
    route: result.route ? buildDelegatedSelection('broad_synthesis', result.route) : null,
  };
}

async function selectPrecisionLookupRoute(
  engine: BrainEngine,
  input: RetrievalRouteSelectorInput,
): Promise<RetrievalRouteSelectorResult> {
  const result = await getPrecisionLookupRoute(engine, {
    scope_id: input.scope_id,
    slug: input.slug,
    section_id: input.section_id,
  });
  return {
    selected_intent: 'precision_lookup',
    selection_reason: result.selection_reason,
    candidate_count: result.candidate_count,
    route: result.route ? buildDelegatedSelection('precision_lookup', result.route) : null,
  };
}

function buildTaskResumeSelection(card: TaskResumeCard): RetrievalRouteSelection {
  return {
    route_kind: 'task_resume',
    retrieval_route: [
      'task_thread',
      'working_set',
      'attempt_decision_history',
      'focused_source_reads',
    ],
    summary_lines: [
      `Task resume is anchored to task ${card.task_id}.`,
      `Latest failed attempts available: ${card.failed_attempts.length}.`,
      `Latest decisions available: ${card.active_decisions.length}.`,
    ],
    payload: card,
  };
}

function buildDelegatedSelection(
  routeKind: 'broad_synthesis' | 'precision_lookup',
  payload: BroadSynthesisRoute | PrecisionLookupRoute,
): RetrievalRouteSelection {
  return {
    route_kind: routeKind,
    retrieval_route: payload.retrieval_route,
    summary_lines: payload.summary_lines,
    payload,
  };
}
