import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  collectImportSummary,
  resolveImportPlan,
  runImportService,
} from '../src/core/services/import-service.ts';
import { runImport } from '../src/commands/import.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe('import service', () => {
  test('collectImportSummary tracks imported, skipped, errors, and unchanged files', () => {
    const summary = collectImportSummary({
      totalFiles: 3,
      events: [
        { type: 'imported', slug: 'notes/a', chunks: 2 },
        { type: 'skipped', reason: 'unchanged' },
        { type: 'error', message: 'bad frontmatter' },
      ],
    });

    expect(summary.imported).toBe(1);
    expect(summary.skipped).toBe(2);
    expect(summary.errors).toBe(1);
    expect(summary.unchanged).toBe(1);
    expect(summary.chunksCreated).toBe(2);
    expect(summary.totalFiles).toBe(3);
  });

  test('resolveImportPlan resumes when checkpoint matches root and file count', () => {
    const allFiles = ['/brain/a.md', '/brain/b.md', '/brain/c.md'];
    const plan = resolveImportPlan({
      rootDir: '/brain',
      allFiles,
      fresh: false,
      checkpoint: {
        dir: '/brain',
        totalFiles: allFiles.length,
        processedIndex: 2,
        timestamp: new Date().toISOString(),
      },
    });

    expect(plan.resumeIndex).toBe(2);
    expect(plan.files).toEqual(['/brain/c.md']);
    expect(plan.resumed).toBe(true);
  });

  test('runImportService writes preserved checkpoints to the custom checkpointPath parent directory', async () => {
    const rootDir = makeTempDir('mbrain-import-root-');
    for (let index = 0; index < 100; index++) {
      writeFileSync(join(rootDir, `${index}.md`), `# note ${index}\n`);
    }

    const checkpointPath = join(rootDir, 'nested', 'state', 'import-checkpoint.json');
    const engine = {
      logIngest: async () => undefined,
      setConfig: async () => undefined,
    } as any;

    const summary = await runImportService(
      engine,
      { rootDir, workers: 1, checkpointPath },
      {
        createConnectedEngine: async () => {
          throw new Error('not used');
        },
        importFile: async (_engine, filePath) => {
          if (filePath.endsWith('99.md')) {
            throw new Error('boom');
          }
          return { slug: filePath, status: 'imported' as const, chunks: 1 };
        },
        loadConfig: () => null,
        supportsParallelWorkers: () => false,
      },
    );

    expect(summary.errors).toBe(1);
    expect(existsSync(checkpointPath)).toBe(true);
    const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf-8'));
    expect(checkpoint.dir).toBe(rootDir);
    expect(checkpoint.totalFiles).toBe(100);
    expect(checkpoint.processedIndex).toBe(100);
  });

  test('runImport prints the final summary before ingest logging errors surface', async () => {
    const rootDir = makeTempDir('mbrain-import-command-');
    writeFileSync(join(rootDir, 'note.md'), [
      '---',
      'title: Note',
      'type: note',
      '---',
      '',
      'Compiled truth.',
    ].join('\n'));

    const logs: string[] = [];
    const consoleLog = console.log;
    console.log = ((msg?: unknown) => {
      logs.push(String(msg ?? ''));
    }) as typeof console.log;

    const engine = {
      connect: async () => undefined,
      disconnect: async () => undefined,
      initSchema: async () => undefined,
      transaction: async (fn: (tx: any) => Promise<unknown>) => fn(engine),
      getPage: async () => null,
      putPage: async () => ({ slug: 'note' }),
      deletePage: async () => undefined,
      listPages: async () => [],
      resolveSlugs: async () => [],
      searchKeyword: async () => [],
      searchVector: async () => [],
      upsertChunks: async () => undefined,
      getChunks: async () => [],
      deleteChunks: async () => undefined,
      getPageEmbeddings: async () => [],
      updatePageEmbedding: async () => undefined,
      addLink: async () => undefined,
      removeLink: async () => undefined,
      getLinks: async () => [],
      getBacklinks: async () => [],
      traverseGraph: async () => [],
      addTag: async () => undefined,
      removeTag: async () => undefined,
      getTags: async () => [],
      addTimelineEntry: async () => undefined,
      getTimeline: async () => [],
      putRawData: async () => undefined,
      getRawData: async () => [],
      createVersion: async () => ({ id: 1 }),
      getVersions: async () => [],
      revertToVersion: async () => undefined,
      getStats: async () => ({
        page_count: 0,
        chunk_count: 0,
        embedded_count: 0,
        link_count: 0,
        tag_count: 0,
        timeline_entry_count: 0,
        pages_by_type: {},
      }),
      getHealth: async () => ({
        page_count: 0,
        embed_coverage: 0,
        stale_pages: 0,
        orphan_pages: 0,
        dead_links: 0,
        missing_embeddings: 0,
      }),
      logIngest: async () => {
        throw new Error('ingest logging failed');
      },
      getIngestLog: async () => [],
      updateSlug: async () => undefined,
      rewriteLinks: async () => undefined,
      getConfig: async () => null,
      setConfig: async () => undefined,
      runMigration: async () => undefined,
      getChunksWithEmbeddings: async () => [],
    } as any;

    try {
      await expect(runImport(engine, [rootDir, '--workers', '1'])).rejects.toThrow('ingest logging failed');
    } finally {
      console.log = consoleLog;
    }

    const output = logs.join('\n');
    expect(output).toContain('Import complete');
    expect(output).toContain('1 pages imported');
  });
});
