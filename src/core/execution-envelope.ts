import type { MBrainConfig } from './config.ts';
import { resolveOfflineProfile } from './offline-profile.ts';

export type BaselineFamily =
  | 'repeated_work'
  | 'markdown_retrieval'
  | 'context_map'
  | 'governance'
  | 'provenance_trace'
  | 'local_performance'
  | 'scope_isolation';

export interface ContractSurfaceStatus {
  status: 'supported' | 'unsupported';
  reason?: string;
}

export interface ExecutionEnvelope {
  mode: 'standard' | 'local_offline';
  markdownCanonical: true;
  derivedArtifactsRegenerable: true;
  baselineFamilies: BaselineFamily[];
  publicContract: {
    files: ContractSurfaceStatus;
    checkUpdate: ContractSurfaceStatus;
  };
  parity: {
    requiresSemanticAlignment: true;
    supportedEngines: Array<MBrainConfig['engine']>;
  };
}

const BASELINE_FAMILIES: BaselineFamily[] = [
  'repeated_work',
  'markdown_retrieval',
  'context_map',
  'governance',
  'provenance_trace',
  'local_performance',
  'scope_isolation',
];

function toSurfaceStatus(status: { supported: boolean; reason?: string }): ContractSurfaceStatus {
  return status.supported ? { status: 'supported' } : { status: 'unsupported', reason: status.reason };
}

export function buildExecutionEnvelope(config: MBrainConfig): ExecutionEnvelope {
  const profile = resolveOfflineProfile(config);

  return {
    mode: profile.status,
    markdownCanonical: true,
    derivedArtifactsRegenerable: true,
    baselineFamilies: [...BASELINE_FAMILIES],
    publicContract: {
      files: toSurfaceStatus(profile.capabilities.files),
      checkUpdate: toSurfaceStatus(profile.capabilities.check_update),
    },
    parity: {
      requiresSemanticAlignment: true,
      supportedEngines: ['postgres', 'sqlite', 'pglite'],
    },
  };
}
