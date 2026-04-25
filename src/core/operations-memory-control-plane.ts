import type { Operation } from './operations.ts';
import type {
  MemoryAccessMode,
  MemoryRealmFilters,
  MemoryRealmInput,
  MemoryRealmScope,
} from './types.ts';

type OperationErrorCtor = new (
  code: 'invalid_params',
  message: string,
  suggestion?: string,
  docs?: string,
) => Error;

const MEMORY_REALM_SCOPES = ['work', 'personal', 'mixed'] as const satisfies readonly MemoryRealmScope[];
const MEMORY_ACCESS_MODES = ['read_only', 'read_write'] as const satisfies readonly MemoryAccessMode[];

function invalidParams(
  deps: { OperationError: OperationErrorCtor },
  message: string,
): Error {
  return new deps.OperationError('invalid_params', message);
}

function requiredString(
  deps: { OperationError: OperationErrorCtor },
  field: string,
  value: unknown,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidParams(deps, `${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(
  deps: { OperationError: OperationErrorCtor },
  field: string,
  value: unknown,
): string | undefined {
  if (value == null) return undefined;
  return requiredString(deps, field, value);
}

function optionalText(
  deps: { OperationError: OperationErrorCtor },
  field: string,
  value: unknown,
): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') {
    throw invalidParams(deps, `${field} must be a string`);
  }
  return value;
}

function enumValue<T extends string>(
  deps: { OperationError: OperationErrorCtor },
  field: string,
  value: unknown,
  allowed: readonly T[],
  required = false,
): T | undefined {
  if (value == null) {
    if (required) {
      throw invalidParams(deps, `${field} must be one of: ${allowed.join(', ')}`);
    }
    return undefined;
  }
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw invalidParams(deps, `${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function optionalBoolean(
  deps: { OperationError: OperationErrorCtor },
  field: string,
  value: unknown,
): boolean | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'boolean') {
    throw invalidParams(deps, `${field} must be a boolean`);
  }
  return value;
}

function integerParam(
  deps: { OperationError: OperationErrorCtor },
  field: string,
  value: unknown,
  options: { defaultValue: number; min: number; max?: number },
): number {
  if (value == null) return options.defaultValue;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < options.min) {
    throw invalidParams(deps, `${field} must be an integer greater than or equal to ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    throw invalidParams(deps, `${field} must be less than or equal to ${options.max}`);
  }
  return value;
}

function optionalIsoDate(
  deps: { OperationError: OperationErrorCtor },
  field: string,
  value: unknown,
): Date | string | null | undefined {
  if (value === null) return null;
  if (value == null) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string') {
    throw invalidParams(deps, `${field} must be an ISO timestamp`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw invalidParams(deps, `${field} must be a valid ISO timestamp`);
  }
  return value;
}

function realmInput(
  deps: { OperationError: OperationErrorCtor },
  p: Record<string, unknown>,
): MemoryRealmInput {
  return {
    id: requiredString(deps, 'id', p.id),
    name: requiredString(deps, 'name', p.name),
    description: optionalText(deps, 'description', p.description) ?? '',
    scope: enumValue(deps, 'scope', p.scope, MEMORY_REALM_SCOPES, true)!,
    default_access: enumValue(deps, 'default_access', p.default_access, MEMORY_ACCESS_MODES) ?? 'read_only',
    retention_policy: optionalText(deps, 'retention_policy', p.retention_policy) ?? 'retain',
    export_policy: optionalText(deps, 'export_policy', p.export_policy) ?? 'private',
    agent_instructions: optionalText(deps, 'agent_instructions', p.agent_instructions) ?? '',
    archived_at: optionalIsoDate(deps, 'archived_at', p.archived_at),
  };
}

function realmFilters(
  deps: { OperationError: OperationErrorCtor },
  p: Record<string, unknown>,
): MemoryRealmFilters {
  return {
    scope: enumValue(deps, 'scope', p.scope, MEMORY_REALM_SCOPES),
    include_archived: optionalBoolean(deps, 'include_archived', p.include_archived),
    limit: integerParam(deps, 'limit', p.limit, { defaultValue: 100, min: 0, max: 500 }),
    offset: integerParam(deps, 'offset', p.offset, { defaultValue: 0, min: 0 }),
  };
}

export function createMemoryControlPlaneOperations(
  deps: { OperationError: OperationErrorCtor },
): Operation[] {
  const upsert_memory_realm: Operation = {
    name: 'upsert_memory_realm',
    description: 'Create or update a memory realm for scoped memory access control.',
    params: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      description: { type: 'string', default: '' },
      scope: { type: 'string', required: true, enum: [...MEMORY_REALM_SCOPES] },
      default_access: { type: 'string', default: 'read_only', enum: [...MEMORY_ACCESS_MODES] },
      retention_policy: { type: 'string', default: 'retain' },
      export_policy: { type: 'string', default: 'private' },
      agent_instructions: { type: 'string', default: '' },
      archived_at: { type: 'string', description: 'Optional ISO timestamp. Null reactivates an archived realm.' },
    },
    mutating: true,
    handler: async (ctx, p) => {
      const input = realmInput(deps, p);
      if (ctx.dryRun) {
        return {
          action: 'upsert_memory_realm',
          dry_run: true,
          realm: input,
        };
      }
      return ctx.engine.upsertMemoryRealm(input);
    },
    cliHints: { name: 'memory-realm-upsert' },
  };

  const get_memory_realm: Operation = {
    name: 'get_memory_realm',
    description: 'Get one memory realm by id.',
    params: {
      id: { type: 'string', required: true },
    },
    mutating: false,
    handler: async (ctx, p) => ctx.engine.getMemoryRealm(requiredString(deps, 'id', p.id)),
    cliHints: { name: 'memory-realm-get', positional: ['id'] },
  };

  const list_memory_realms: Operation = {
    name: 'list_memory_realms',
    description: 'List memory realms. Archived realms are excluded unless include_archived is true.',
    params: {
      scope: { type: 'string', enum: [...MEMORY_REALM_SCOPES] },
      include_archived: { type: 'boolean', default: false },
      limit: { type: 'number', default: 100 },
      offset: { type: 'number', default: 0 },
    },
    mutating: false,
    handler: async (ctx, p) => ctx.engine.listMemoryRealms(realmFilters(deps, p)),
    cliHints: { name: 'memory-realm-list', aliases: { n: 'limit' } },
  };

  return [upsert_memory_realm, get_memory_realm, list_memory_realms];
}
