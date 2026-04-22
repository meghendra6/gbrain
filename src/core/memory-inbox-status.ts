import type {
  MemoryCandidateCreateStatus,
  MemoryCandidateStatus,
  MemoryCandidateStatusPatch,
} from './types.ts';

export function isMemoryCandidateCreateStatus(
  status: MemoryCandidateStatus,
): status is MemoryCandidateCreateStatus {
  return status === 'captured'
    || status === 'candidate'
    || status === 'staged_for_review';
}

export function assertMemoryCandidateCreateStatus(
  status: MemoryCandidateStatus,
): MemoryCandidateCreateStatus {
  if (!isMemoryCandidateCreateStatus(status)) {
    throw new Error(
      `Cannot create memory candidate directly in ${status} status; use bounded governance workflows instead.`,
    );
  }
  return status;
}

export function isAllowedMemoryCandidateStatusUpdate(
  currentStatus: MemoryCandidateStatus,
  nextStatus: MemoryCandidateStatusPatch['status'],
): boolean {
  switch (currentStatus) {
    case 'captured':
      return nextStatus === 'candidate';
    case 'candidate':
      return nextStatus === 'staged_for_review';
    case 'staged_for_review':
      return nextStatus === 'rejected';
    case 'rejected':
    case 'promoted':
      return false;
  }
}
