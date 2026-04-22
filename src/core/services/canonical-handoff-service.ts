import type { BrainEngine } from '../engine.ts';
import type {
  CanonicalHandoffEntry,
  CanonicalHandoffTargetObjectType,
  MemoryCandidateEntry,
} from '../types.ts';
import { MemoryInboxServiceError } from './memory-inbox-service.ts';

const ISO_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-])(\d{2}):(\d{2}))$/;

export interface RecordCanonicalHandoffInput {
  candidate_id: string;
  reviewed_at?: Date | string | null;
  review_reason?: string | null;
}

export interface RecordCanonicalHandoffResult {
  candidate: MemoryCandidateEntry;
  handoff: CanonicalHandoffEntry;
}

export async function recordCanonicalHandoff(
  engine: BrainEngine,
  input: RecordCanonicalHandoffInput,
): Promise<RecordCanonicalHandoffResult> {
  const candidate = await engine.getMemoryCandidateEntry(input.candidate_id);
  if (!candidate) {
    throw new MemoryInboxServiceError(
      'memory_candidate_not_found',
      `Memory candidate not found: ${input.candidate_id}`,
    );
  }

  if (candidate.status !== 'promoted') {
    throw new MemoryInboxServiceError(
      'invalid_status_transition',
      `Cannot record canonical handoff from ${candidate.status}; only promoted candidates may be handed off.`,
    );
  }

  const targetObjectType = getCanonicalHandoffTargetObjectType(candidate);
  if (!targetObjectType || !candidate.target_object_id || candidate.target_object_id.trim().length === 0) {
    throw new MemoryInboxServiceError(
      'invalid_status_transition',
      `Cannot record canonical handoff for ${candidate.id}; candidate is missing an eligible canonical target.`,
    );
  }

  const reviewedAt = normalizeReviewedAt(input.reviewed_at);
  const handoff = await engine.createCanonicalHandoffEntry({
    id: crypto.randomUUID(),
    scope_id: candidate.scope_id,
    candidate_id: candidate.id,
    target_object_type: targetObjectType,
    target_object_id: candidate.target_object_id,
    source_refs: [...candidate.source_refs],
    reviewed_at: reviewedAt,
    review_reason: input.review_reason ?? null,
  });
  if (!handoff) {
    throw new MemoryInboxServiceError(
      'invalid_status_transition',
      `Cannot record canonical handoff for ${candidate.id}; current state changed or the handoff already exists.`,
    );
  }

  return { candidate, handoff };
}

function getCanonicalHandoffTargetObjectType(
  candidate: MemoryCandidateEntry,
): CanonicalHandoffTargetObjectType | null {
  switch (candidate.target_object_type) {
    case 'curated_note':
    case 'procedure':
    case 'profile_memory':
    case 'personal_episode':
      return candidate.target_object_type;
    case 'other':
    case null:
      return null;
  }
}

function normalizeReviewedAt(value: Date | string | null | undefined): Date | string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new MemoryInboxServiceError(
        'invalid_status_transition',
        'reviewed_at must be a valid Date when provided.',
      );
    }
    return value;
  }
  if (!ISO_DATETIME_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new MemoryInboxServiceError(
      'invalid_status_transition',
      'reviewed_at must be a valid ISO datetime string when provided.',
    );
  }
  return value;
}
