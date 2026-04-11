import OpenAI from 'openai';
import type { EmbeddingProvider as EmbeddingProviderMode, GBrainConfig } from '../config.ts';

const OPENAI_MODEL = 'text-embedding-3-large';
const OPENAI_DIMENSIONS = 1536;
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 4000;
const MAX_DELAY_MS = 120000;
const DEFAULT_LOCAL_MODEL = 'nomic-embed-text';

let openAIClient: OpenAI | null = null;

export interface EmbeddingProviderCapability {
  mode: EmbeddingProviderMode;
  available: boolean;
  implementation: 'none' | 'local-http' | 'legacy-openai' | 'test-local';
  model: string | null;
  dimensions: number | null;
  reason?: string;
}

export interface ResolvedEmbeddingProvider {
  capability: EmbeddingProviderCapability;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}

export interface ResolveEmbeddingProviderOptions {
  config?: GBrainConfig | null;
  allowLegacyOpenAIFallback?: boolean;
}

export function resolveEmbeddingProvider(
  opts: ResolveEmbeddingProviderOptions = {},
): ResolvedEmbeddingProvider {
  const config = opts.config ?? null;
  const mode: EmbeddingProviderMode = config?.embedding_provider ?? 'none';
  const localProvider = resolveLocalProvider(mode);
  if (localProvider) {
    return localProvider;
  }

  if (opts.allowLegacyOpenAIFallback && !config?.offline && process.env.OPENAI_API_KEY) {
    return createLegacyOpenAIProvider(mode);
  }

  return unavailableProvider({
    mode,
    available: false,
    implementation: 'none',
    model: null,
    dimensions: null,
    reason: mode === 'local'
      ? 'Local embedding runtime is not configured. Set OLLAMA_HOST or GBRAIN_LOCAL_EMBEDDING_URL.'
      : 'No embedding provider configured. Use gbrain embed after configuring a local runtime.',
  });
}

function resolveLocalProvider(mode: EmbeddingProviderMode): ResolvedEmbeddingProvider | null {
  if (mode !== 'local') return null;

  const configuredUrl = resolveLocalEmbeddingUrl();
  if (!configuredUrl) {
    return null;
  }

  const configuredModel = process.env.GBRAIN_LOCAL_EMBEDDING_MODEL || DEFAULT_LOCAL_MODEL;
  const configuredDimensions = parsePositiveInt(process.env.GBRAIN_LOCAL_EMBEDDING_DIMENSIONS);

  return {
    capability: {
      mode,
      available: true,
      implementation: 'local-http',
      model: configuredModel,
      dimensions: configuredDimensions,
    },
    embedBatch: async (texts: string[]) => {
      const response = await fetch(configuredUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: configuredModel,
          input: texts,
        }),
      });

      if (!response.ok) {
        throw new Error(`Local embedding runtime returned ${response.status} ${response.statusText}`);
      }

      const payload = await response.json() as {
        embeddings?: number[][];
        data?: Array<{ embedding?: number[] }>;
      };

      const embeddings = Array.isArray(payload.embeddings)
        ? payload.embeddings
        : Array.isArray(payload.data)
          ? payload.data.map(item => item.embedding ?? [])
          : [];

      if (embeddings.length !== texts.length || embeddings.some(vector => vector.length === 0)) {
        throw new Error('Local embedding runtime returned an unexpected embedding payload');
      }

      return embeddings.map(vector => new Float32Array(vector));
    },
  };
}

function resolveLocalEmbeddingUrl(): string | null {
  const configured = process.env.GBRAIN_LOCAL_EMBEDDING_URL;
  if (configured) return configured;

  const ollamaHost = process.env.OLLAMA_HOST;
  if (ollamaHost) {
    return new URL('/api/embed', withTrailingSlash(ollamaHost)).toString();
  }

  if (process.env.GBRAIN_LOCAL_EMBEDDING_MODEL) {
    return 'http://127.0.0.1:11434/api/embed';
  }

  return null;
}

function createLegacyOpenAIProvider(mode: EmbeddingProviderMode): ResolvedEmbeddingProvider {
  return {
    capability: {
      mode,
      available: true,
      implementation: 'legacy-openai',
      model: OPENAI_MODEL,
      dimensions: OPENAI_DIMENSIONS,
      reason: 'Using OpenAI compatibility fallback until a local runtime is configured.',
    },
    embedBatch: (texts: string[]) => embedWithOpenAI(texts),
  };
}

async function embedWithOpenAI(texts: string[]): Promise<Float32Array[]> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await getOpenAIClient().embeddings.create({
        model: OPENAI_MODEL,
        input: texts,
        dimensions: OPENAI_DIMENSIONS,
      });

      return response.data
        .sort((a, b) => a.index - b.index)
        .map(item => new Float32Array(item.embedding));
    } catch (error: unknown) {
      if (attempt === MAX_RETRIES - 1) {
        throw error;
      }

      let delay = exponentialDelay(attempt);
      if (error instanceof OpenAI.APIError && error.status === 429) {
        const retryAfter = error.headers?.['retry-after'];
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          if (!Number.isNaN(parsed)) {
            delay = parsed * 1000;
          }
        }
      }

      await sleep(delay);
    }
  }

  throw new Error('Embedding failed after all retries');
}

function getOpenAIClient(): OpenAI {
  if (!openAIClient) {
    openAIClient = new OpenAI();
  }
  return openAIClient;
}

function unavailableProvider(capability: EmbeddingProviderCapability): ResolvedEmbeddingProvider {
  return {
    capability,
    embedBatch: async () => {
      throw new Error(capability.reason || 'Embedding provider unavailable');
    },
  };
}

function exponentialDelay(attempt: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function withTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
