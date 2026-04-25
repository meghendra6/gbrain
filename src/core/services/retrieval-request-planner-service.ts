import type {
  RetrievalRequestPlan,
  RetrievalRequestPlannerInput,
  RetrievalRouteIntent,
  RetrievalRouteSelectorInput,
} from '../types.ts';

export function planRetrievalRequest(input: RetrievalRequestPlannerInput): RetrievalRequestPlan {
  if (
    input.allow_decomposition === true
    && (input.intent === undefined || input.intent === 'task_resume')
    && input.task_id
    && input.query
  ) {
    return {
      selection_reason: 'decomposed_mixed_intent',
      steps: [
        buildStep('step-1-task-resume', 'task_resume', input),
        buildStep('step-2-broad-synthesis', 'broad_synthesis', input),
      ],
    };
  }

  const inferredIntent = input.intent ?? inferSingleIntent(input);
  if (!inferredIntent) {
    return {
      selection_reason: 'no_match',
      steps: [],
    };
  }

  return {
    selection_reason: 'single_intent',
    steps: [buildStep('step-1-single-intent', inferredIntent, input)],
  };
}

function inferSingleIntent(input: RetrievalRequestPlannerInput): RetrievalRouteIntent | null {
  if (input.requested_scope === 'mixed' && input.query && (input.subject || input.episode_title)) {
    return 'mixed_scope_bridge';
  }
  if (input.task_id) return 'task_resume';
  if (input.slug || input.path || input.section_id || input.source_ref) return 'precision_lookup';
  if (input.subject) return 'personal_profile_lookup';
  if (input.episode_title) return 'personal_episode_lookup';
  if (input.query) return 'broad_synthesis';
  return null;
}

function buildStep(
  step_id: string,
  intent: RetrievalRouteIntent,
  input: RetrievalRequestPlannerInput,
): RetrievalRequestPlan['steps'][number] {
  const selectorInput: RetrievalRouteSelectorInput = {
    ...input,
    intent,
  };
  delete (selectorInput as { allow_decomposition?: boolean }).allow_decomposition;
  return {
    step_id,
    intent,
    input: selectorInput,
  };
}
