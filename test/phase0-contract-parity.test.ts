import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import postgres from 'postgres';
import type { BrainEngine } from '../src/core/engine.ts';
import { ensurePageChunks } from '../src/core/page-chunks.ts';
import { PGLiteEngine } from '../src/core/pglite-engine.ts';
import { PostgresEngine } from '../src/core/postgres-engine.ts';
import { SQLiteEngine } from '../src/core/sqlite-engine.ts';
import type { PageType } from '../src/core/types.ts';

type SharedWorkflowEngine = Pick<
  BrainEngine,
  'putPage' | 'getPage' | 'listPages' | 'addTag' | 'getTags' | 'addTimelineEntry' | 'getTimeline' | 'searchKeyword'
> & {
  connect(config: Record<string, unknown>): Promise<void>;
  disconnect(): Promise<void>;
  initSchema(): Promise<void>;
};

type WorkflowSnapshot = {
  pages: Record<string, {
    type: PageType;
    title: string;
    compiled_truth: string;
    frontmatter: Record<string, unknown>;
  }>;
  lists: {
    concepts: string[];
    redesign: string[];
  };
  search: {
    contractSurface: string[];
    executionEnvelope: string[];
  };
  tags: Record<string, string[]>;
  timeline: Record<string, Array<{
    date: string;
    detail: string;
    source: string;
    summary: string;
  }>>;
};

const FIXTURE_PAGES = [
  {
    slug: 'concepts/phase0',
    type: 'concept' as const,
    title: 'Phase 0',
    compiled_truth: 'Phase 0 defines the execution envelope and baseline harness for contract-surface verification.',
    frontmatter: {
      contract_surface: 'phase0',
      execution_envelope: 'local_offline',
    },
    tags: ['redesign'],
    timeline: [
      {
        date: '2026-04-19',
        detail: 'The execution envelope became the Phase 0 baseline contract.',
        source: 'implementation-plan',
        summary: 'Execution envelope defined',
      },
    ],
  },
  {
    slug: 'concepts/local-offline',
    type: 'concept' as const,
    title: 'Local Offline Contract',
    compiled_truth: 'Local offline mode keeps the contract surface honest when cloud file storage is unsupported.',
    frontmatter: {
      contract_surface: 'local_offline',
      execution_envelope: 'local_path',
    },
    tags: ['local-path'],
    timeline: [
      {
        date: '2026-04-20',
        detail: 'Local-path semantics must report file/storage limits explicitly.',
        source: 'implementation-plan',
        summary: 'Contract surface documented',
      },
    ],
  },
] as const;

const EXPECTED_SNAPSHOT: WorkflowSnapshot = {
  pages: {
    'concepts/local-offline': {
      type: 'concept',
      title: 'Local Offline Contract',
      compiled_truth: 'Local offline mode keeps the contract surface honest when cloud file storage is unsupported.',
      frontmatter: {
        contract_surface: 'local_offline',
        execution_envelope: 'local_path',
      },
    },
    'concepts/phase0': {
      type: 'concept',
      title: 'Phase 0',
      compiled_truth: 'Phase 0 defines the execution envelope and baseline harness for contract-surface verification.',
      frontmatter: {
        contract_surface: 'phase0',
        execution_envelope: 'local_offline',
      },
    },
  },
  lists: {
    concepts: ['concepts/local-offline', 'concepts/phase0'],
    redesign: ['concepts/phase0'],
  },
  search: {
    contractSurface: ['concepts/local-offline'],
    executionEnvelope: ['concepts/phase0'],
  },
  tags: {
    'concepts/local-offline': ['local-path'],
    'concepts/phase0': ['redesign'],
  },
  timeline: {
    'concepts/local-offline': [
      {
        date: '2026-04-20',
        detail: 'Local-path semantics must report file/storage limits explicitly.',
        source: 'implementation-plan',
        summary: 'Contract surface documented',
      },
    ],
    'concepts/phase0': [
      {
        date: '2026-04-19',
        detail: 'The execution envelope became the Phase 0 baseline contract.',
        source: 'implementation-plan',
        summary: 'Execution envelope defined',
      },
    ],
  },
};

function normalizeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

async function seedSharedWorkflow(engine: SharedWorkflowEngine): Promise<void> {
  for (const fixture of FIXTURE_PAGES) {
    const page = await engine.putPage(fixture.slug, {
      type: fixture.type,
      title: fixture.title,
      compiled_truth: fixture.compiled_truth,
      frontmatter: fixture.frontmatter,
    });

    await ensurePageChunks(engine as BrainEngine, page);

    for (const tag of fixture.tags) {
      await engine.addTag(fixture.slug, tag);
      await engine.addTag(fixture.slug, tag);
    }

    for (const entry of fixture.timeline) {
      await engine.addTimelineEntry(fixture.slug, entry);
    }
  }
}

async function collectWorkflowSnapshot(engine: SharedWorkflowEngine): Promise<WorkflowSnapshot> {
  const pages = Object.fromEntries(
    (await Promise.all(FIXTURE_PAGES.map(async (fixture) => {
      const page = await engine.getPage(fixture.slug);
      expect(page).not.toBeNull();
      return [
        fixture.slug,
        {
          type: page!.type,
          title: page!.title,
          compiled_truth: page!.compiled_truth,
          frontmatter: page!.frontmatter,
        },
      ] as const;
    }))).sort(([left], [right]) => left.localeCompare(right)),
  );

  const tags = Object.fromEntries(
    (await Promise.all(FIXTURE_PAGES.map(async (fixture) => {
      const pageTags = await engine.getTags(fixture.slug);
      return [fixture.slug, [...pageTags].sort()] as const;
    }))).sort(([left], [right]) => left.localeCompare(right)),
  );

  const timeline = Object.fromEntries(
    (await Promise.all(FIXTURE_PAGES.map(async (fixture) => {
      const entries = await engine.getTimeline(fixture.slug);
      return [
        fixture.slug,
        entries.map((entry) => ({
          date: normalizeDate(entry.date),
          detail: entry.detail,
          source: entry.source,
          summary: entry.summary,
        })),
      ] as const;
    }))).sort(([left], [right]) => left.localeCompare(right)),
  );

  return {
    pages,
    lists: {
      concepts: (await engine.listPages({ type: 'concept' })).map((page) => page.slug).sort(),
      redesign: (await engine.listPages({ tag: 'redesign' })).map((page) => page.slug).sort(),
    },
    search: {
      contractSurface: (await engine.searchKeyword('cloud file storage unsupported')).map((result) => result.slug).sort(),
      executionEnvelope: (await engine.searchKeyword('execution envelope baseline harness')).map((result) => result.slug).sort(),
    },
    tags,
    timeline,
  };
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function buildSchemaScopedDatabaseUrl(databaseUrl: string, schemaName: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set('options', `-c search_path=${schemaName},public`);
  return url.toString();
}

const root = mkdtempSync(join(tmpdir(), 'mbrain-phase0-parity-'));
const sqlite = new SQLiteEngine();
const pglite = new PGLiteEngine();

beforeAll(async () => {
  await sqlite.connect({ engine: 'sqlite', database_path: join(root, 'brain.db') });
  await sqlite.initSchema();
  await seedSharedWorkflow(sqlite);

  await pglite.connect({ engine: 'pglite', database_path: join(root, 'brain.pglite') });
  await pglite.initSchema();
  await seedSharedWorkflow(pglite);
});

afterAll(async () => {
  await sqlite.disconnect();
  await pglite.disconnect();
  rmSync(root, { recursive: true, force: true });
});

describe('phase0 contract parity', () => {
  test('sqlite and pglite agree on shared operation-backed workflows', async () => {
    const sqliteSnapshot = await collectWorkflowSnapshot(sqlite);
    const pgliteSnapshot = await collectWorkflowSnapshot(pglite);

    expect(sqliteSnapshot).toEqual(EXPECTED_SNAPSHOT);
    expect(pgliteSnapshot).toEqual(EXPECTED_SNAPSHOT);
    expect(sqliteSnapshot).toEqual(pgliteSnapshot);
  });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    test.skip('postgres parity skipped: DATABASE_URL is not configured', () => {});
    return;
  }

  test('postgres matches the same shared workflow semantics', async () => {
    const schemaName = `phase0_parity_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const admin = postgres(databaseUrl, {
      connect_timeout: 10,
      idle_timeout: 1,
      max: 1,
      types: { bigint: postgres.BigInt },
    });
    const engine = new PostgresEngine();

    try {
      await admin.unsafe(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
      await engine.connect({
        engine: 'postgres',
        database_url: buildSchemaScopedDatabaseUrl(databaseUrl, schemaName),
        poolSize: 1,
      });
      await engine.initSchema();
      await seedSharedWorkflow(engine);

      const postgresSnapshot = await collectWorkflowSnapshot(engine);
      const sqliteSnapshot = await collectWorkflowSnapshot(sqlite);

      expect(postgresSnapshot).toEqual(EXPECTED_SNAPSHOT);
      expect(postgresSnapshot).toEqual(sqliteSnapshot);
    } finally {
      await engine.disconnect().catch(() => undefined);
      await admin.unsafe(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`).catch(() => undefined);
      await admin.end({ timeout: 0 });
    }
  });
});
