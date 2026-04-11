import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runEmbed } from '../src/commands/embed.ts';
import { getEmbeddingProvider, resetEmbeddingProviderForTests, setEmbeddingProviderForTests } from '../src/core/embedding.ts';
import { importFile } from '../src/core/import-file.ts';
import { hybridSearch } from '../src/core/search/hybrid.ts';
import { SQLiteEngine } from '../src/core/sqlite-engine.ts';

let tempDir = '';
let dbPath = '';
let engine: SQLiteEngine;

function createFakeProvider() {
  const batches: string[][] = [];
  return {
    batches,
    provider: {
      capability: {
        available: true,
        mode: 'local' as const,
        implementation: 'test-local',
        model: 'test-local-v1',
        dimensions: 3,
      },
      embedBatch: async (texts: string[]) => {
        batches.push([...texts]);
        return texts.map((text, index) => new Float32Array([text.length, index + 1, texts.length]));
      },
    },
  };
}

function createMappedProvider(vectors: Record<string, number[]>) {
  return {
    capability: {
      available: true,
      mode: 'local' as const,
      implementation: 'test-local',
      model: 'test-local-v1',
      dimensions: Object.values(vectors)[0]?.length ?? null,
    },
    embedBatch: async (texts: string[]) => texts.map((text) => {
      const vector = vectors[text];
      if (!vector) {
        throw new Error(`No test embedding configured for "${text}"`);
      }
      return new Float32Array(vector);
    }),
  };
}

function createUnavailableProvider(reason: string) {
  return {
    capability: {
      available: false,
      mode: 'none' as const,
      implementation: 'none' as const,
      model: null,
      dimensions: null,
      reason,
    },
    embedBatch: async () => {
      throw new Error(reason);
    },
  };
}

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'gbrain-local-offline-'));
  dbPath = join(tempDir, 'brain.db');
  engine = new SQLiteEngine();
  await engine.connect({ engine: 'sqlite', database_path: dbPath });
  await engine.initSchema();
});

afterEach(async () => {
  resetEmbeddingProviderForTests();
  await engine.disconnect();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('local/offline embedding flow', () => {
  test('embedding provider none stays unavailable even if OPENAI_API_KEY is set', () => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';

    try {
      const provider = getEmbeddingProvider({
        config: {
          engine: 'postgres',
          database_url: 'postgres://example',
          offline: false,
          embedding_provider: 'none',
          query_rewrite_provider: 'none',
        },
      });

      expect(provider.capability.available).toBe(false);
      expect(provider.capability.mode).toBe('none');
      expect(provider.capability.implementation).toBe('none');
    } finally {
      if (previous === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previous;
      }
    }
  });

  test('local provider stays unavailable without a configured local runtime', () => {
    const previousOpenAI = process.env.OPENAI_API_KEY;
    const previousLocalUrl = process.env.GBRAIN_LOCAL_EMBEDDING_URL;
    const previousOllama = process.env.OLLAMA_HOST;

    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.GBRAIN_LOCAL_EMBEDDING_URL;
    delete process.env.OLLAMA_HOST;

    try {
      const provider = getEmbeddingProvider({
        config: {
          engine: 'sqlite',
          database_path: join(tempDir, 'brain.db'),
          offline: true,
          embedding_provider: 'local',
          query_rewrite_provider: 'heuristic',
        },
      });

      expect(provider.capability.available).toBe(false);
      expect(provider.capability.mode).toBe('local');
      expect(provider.capability.implementation).toBe('none');
    } finally {
      if (previousOpenAI === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousOpenAI;
      }

      if (previousLocalUrl === undefined) {
        delete process.env.GBRAIN_LOCAL_EMBEDDING_URL;
      } else {
        process.env.GBRAIN_LOCAL_EMBEDDING_URL = previousLocalUrl;
      }

      if (previousOllama === undefined) {
        delete process.env.OLLAMA_HOST;
      } else {
        process.env.OLLAMA_HOST = previousOllama;
      }
    }
  });

  test('deferred re-import marks rewritten chunks as missing embeddings', async () => {
    const firstProvider = createFakeProvider();
    setEmbeddingProviderForTests(firstProvider.provider);

    const filePath = join(tempDir, 'rewritten.md');
    writeFileSync(filePath, `---
type: concept
title: Rewritten
---

Original chunk content for the page.
`);

    await importFile(engine, filePath, 'concepts/rewritten.md');
    await runEmbed(engine, ['concepts/rewritten']);

    const embeddedBeforeRewrite = await engine.getChunks('concepts/rewritten');
    expect(embeddedBeforeRewrite.every(chunk => chunk.embedded_at instanceof Date)).toBe(true);

    writeFileSync(filePath, `---
type: concept
title: Rewritten
---

Updated chunk content for the same page.
`);

    const secondImport = await importFile(engine, filePath, 'concepts/rewritten.md');
    expect(secondImport.status).toBe('imported');

    const chunksAfterRewrite = await engine.getChunks('concepts/rewritten');
    expect(chunksAfterRewrite).toHaveLength(1);
    expect(chunksAfterRewrite[0].chunk_text).toContain('Updated chunk content');
    expect(chunksAfterRewrite[0].embedded_at).toBeNull();
    expect(chunksAfterRewrite[0].model).toBe('text-embedding-3-large');
  });

  test('stale-only embedding updates only missing chunks', async () => {
    const fake = createFakeProvider();
    setEmbeddingProviderForTests(fake.provider);

    await engine.putPage('concepts/stale-only', {
      type: 'concept',
      title: 'Stale Only',
      compiled_truth: 'already embedded\nneeds embedding',
      timeline: 'still missing',
      frontmatter: {},
    });
    await engine.upsertChunks('concepts/stale-only', [
      {
        chunk_index: 0,
        chunk_text: 'already embedded',
        chunk_source: 'compiled_truth',
        embedding: new Float32Array([9, 9, 9]),
        model: 'seed-model',
        token_count: 3,
      },
      {
        chunk_index: 1,
        chunk_text: 'needs embedding',
        chunk_source: 'compiled_truth',
      },
      {
        chunk_index: 2,
        chunk_text: 'still missing',
        chunk_source: 'timeline',
      },
    ]);

    const before = await engine.getChunks('concepts/stale-only');
    const originalEmbeddedAt = before[0].embedded_at?.toISOString();

    await runEmbed(engine, ['--stale']);

    expect(fake.batches).toEqual([['needs embedding', 'still missing']]);

    const after = await engine.getChunks('concepts/stale-only');
    expect(after[0].model).toBe('seed-model');
    expect(after[0].embedded_at?.toISOString()).toBe(originalEmbeddedAt);
    expect(after[1].embedded_at).toBeInstanceOf(Date);
    expect(after[1].model).toBe('test-local-v1');
    expect(after[2].embedded_at).toBeInstanceOf(Date);
    expect(after[2].model).toBe('test-local-v1');
  });

  test('unchanged content does not trigger re-embedding', async () => {
    const fake = createFakeProvider();
    setEmbeddingProviderForTests(fake.provider);

    const filePath = join(tempDir, 'unchanged.md');
    writeFileSync(filePath, `---
type: concept
title: Unchanged
---

This page should only be embedded during explicit backfill.
`);

    const first = await importFile(engine, filePath, 'concepts/unchanged.md');
    expect(first.status).toBe('imported');
    expect(fake.batches).toEqual([]);

    await runEmbed(engine, ['concepts/unchanged']);
    expect(fake.batches).toHaveLength(1);

    const before = await engine.getChunks('concepts/unchanged');
    const second = await importFile(engine, filePath, 'concepts/unchanged.md');
    const after = await engine.getChunks('concepts/unchanged');

    expect(second.status).toBe('skipped');
    expect(fake.batches).toHaveLength(1);
    expect(after.map(chunk => chunk.model)).toEqual(before.map(chunk => chunk.model));
    expect(after.map(chunk => chunk.embedded_at?.toISOString())).toEqual(
      before.map(chunk => chunk.embedded_at?.toISOString()),
    );
  });

  test('page-level explicit embed rebuilds already-embedded chunks', async () => {
    const firstProvider = createFakeProvider();
    setEmbeddingProviderForTests(firstProvider.provider);

    const filePath = join(tempDir, 'page-rebuild.md');
    writeFileSync(filePath, `---
type: concept
title: Page Rebuild
---

First chunk sentence.

---

Timeline sentence.
`);

    await importFile(engine, filePath, 'concepts/page-rebuild.md');
    await runEmbed(engine, ['concepts/page-rebuild']);

    const initialChunks = await engine.getChunks('concepts/page-rebuild');
    expect(initialChunks.every(chunk => chunk.model === 'test-local-v1')).toBe(true);

    const rebuildBatches: string[][] = [];
    setEmbeddingProviderForTests({
      capability: {
        available: true,
        mode: 'local',
        implementation: 'test-local',
        model: 'test-local-v2',
        dimensions: 3,
      },
      embedBatch: async (texts: string[]) => {
        rebuildBatches.push([...texts]);
        return texts.map((text, index) => new Float32Array([text.length, index + 10, 2]));
      },
    });

    await runEmbed(engine, ['concepts/page-rebuild']);

    expect(rebuildBatches).toEqual([initialChunks.map(chunk => chunk.chunk_text)]);

    const rebuiltChunks = await engine.getChunks('concepts/page-rebuild');
    expect(rebuiltChunks.every(chunk => chunk.model === 'test-local-v2')).toBe(true);
    expect(rebuiltChunks.every(chunk => chunk.embedded_at instanceof Date)).toBe(true);
  });

  test('sqlite local vector search ranks embedded chunks by cosine similarity', async () => {
    await engine.putPage('concepts/vector-top', {
      type: 'concept',
      title: 'Vector Top',
      compiled_truth: 'Highest cosine similarity match.',
      timeline: '',
      frontmatter: {},
    });
    await engine.upsertChunks('concepts/vector-top', [
      {
        chunk_index: 0,
        chunk_text: 'Highest cosine similarity match.',
        chunk_source: 'compiled_truth',
        embedding: new Float32Array([1, 0, 0]),
      },
    ]);

    await engine.putPage('concepts/vector-second', {
      type: 'concept',
      title: 'Vector Second',
      compiled_truth: 'Second-best cosine similarity match.',
      timeline: '',
      frontmatter: {},
    });
    await engine.upsertChunks('concepts/vector-second', [
      {
        chunk_index: 0,
        chunk_text: 'Second-best cosine similarity match.',
        chunk_source: 'compiled_truth',
        embedding: new Float32Array([0.5, 0.5, 0]),
      },
    ]);

    const results = await engine.searchVector(new Float32Array([1, 0, 0]), { limit: 2 });

    expect(results.map(result => result.slug)).toEqual([
      'concepts/vector-top',
      'concepts/vector-second',
    ]);
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  test('hybrid search falls back to keyword-only when query embeddings are unavailable', async () => {
    setEmbeddingProviderForTests(createUnavailableProvider('offline embedding runtime unavailable'));

    await engine.putPage('concepts/keyword-only', {
      type: 'concept',
      title: 'Keyword Only',
      compiled_truth: 'Offline retrieval fallback keeps keyword search working.',
      timeline: '',
      frontmatter: {},
    });
    await engine.upsertChunks('concepts/keyword-only', [
      {
        chunk_index: 0,
        chunk_text: 'Offline retrieval fallback keeps keyword search working.',
        chunk_source: 'compiled_truth',
      },
    ]);

    const keywordResults = await engine.searchKeyword('offline retrieval fallback', { limit: 5 });
    const hybridResults = await hybridSearch(engine, 'offline retrieval fallback', { limit: 5 });

    expect(hybridResults).toEqual(keywordResults);
  });

  test('hybrid search fuses vector and keyword rankings when both are available', async () => {
    setEmbeddingProviderForTests(createMappedProvider({
      'hybrid fusion': [1, 0, 0],
    }));

    await engine.putPage('concepts/semantic-match', {
      type: 'project',
      title: 'Semantic Match',
      compiled_truth: 'A concept about dense embeddings and latent neighbors.',
      timeline: '',
      frontmatter: {},
    });
    await engine.upsertChunks('concepts/semantic-match', [
      {
        chunk_index: 0,
        chunk_text: 'Dense embedding neighbors line up with the intent.',
        chunk_source: 'compiled_truth',
        embedding: new Float32Array([0.92, 0.08, 0]),
      },
    ]);

    await engine.putPage('concepts/overlap-match', {
      type: 'concept',
      title: 'Overlap Match',
      compiled_truth: 'Hybrid fusion keeps exact hybrid fusion phrasing near the top.',
      timeline: '',
      frontmatter: {},
    });
    await engine.upsertChunks('concepts/overlap-match', [
      {
        chunk_index: 0,
        chunk_text: 'hybrid fusion stays strong when keyword and vector evidence agree',
        chunk_source: 'compiled_truth',
        embedding: new Float32Array([1, 0, 0]),
      },
    ]);

    const results = await hybridSearch(engine, 'hybrid fusion', { limit: 5 });

    expect(results[0]?.slug).toBe('concepts/overlap-match');
    expect(results.some(result => result.slug === 'concepts/semantic-match')).toBe(true);
    const semanticResult = results.find(result => result.slug === 'concepts/semantic-match');
    expect(results[0]?.score).toBeGreaterThan(semanticResult?.score ?? 0);
  });

  test('hybrid search fuses available vector results when embedding coverage is partial', async () => {
    setEmbeddingProviderForTests(createMappedProvider({
      'partial coverage': [1, 0, 0],
    }));

    await engine.putPage('concepts/vector-covered', {
      type: 'concept',
      title: 'Vector Covered',
      compiled_truth: 'Semantic chunk without exact query terms.',
      timeline: '',
      frontmatter: {},
    });
    await engine.upsertChunks('concepts/vector-covered', [
      {
        chunk_index: 0,
        chunk_text: 'Nearest-neighbor recall from the local vector store.',
        chunk_source: 'compiled_truth',
        embedding: new Float32Array([1, 0, 0]),
      },
    ]);

    await engine.putPage('concepts/keyword-only-partial', {
      type: 'concept',
      title: 'Keyword Only Partial',
      compiled_truth: 'partial coverage must still surface keyword hits without stored embeddings.',
      timeline: '',
      frontmatter: {},
    });
    await engine.upsertChunks('concepts/keyword-only-partial', [
      {
        chunk_index: 0,
        chunk_text: 'partial coverage must still surface keyword hits without stored embeddings.',
        chunk_source: 'compiled_truth',
      },
    ]);

    const results = await hybridSearch(engine, 'partial coverage', { limit: 5 });

    expect(results.map(result => result.slug)).toEqual([
      'concepts/vector-covered',
      'concepts/keyword-only-partial',
    ]);
    expect(results[1]?.chunk_text).toContain('partial coverage');
  });
});
