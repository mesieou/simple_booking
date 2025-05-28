import { Embedding } from '@/lib/models/embeddings';
import { EMBEDDING_CONFIG, ContentChunk } from '@/lib/config/config';
import { generateEmbedding } from '@/lib/helpers/openai/functions/embeddings';
import { pushToQueue } from '@/lib/helpers/openai/rate-limiter';
import { retry } from 'ts-retry-promise';
import { logger } from '@/lib/bot/content-crawler/process-content/logger';
import { saveLlmInteraction } from '../logger-artifact-savers';

// Helper to wrap generateEmbedding in the OpenAI queue
export function embeddingInQueue(
  text: string, 
  sourceUrl: string,
  interactionBaseId: string
): Promise<number[]> {
  return new Promise((resolve, reject) => {
    pushToQueue(async () => {
      const interactionId = `${interactionBaseId}_embedding`;
      try {
        const result = await generateEmbedding(text);
        saveLlmInteraction(sourceUrl, interactionId, text, result).catch(err => {
          console.error(`[EmbeddingCreator] Failed to save LLM interaction log for ${interactionId}:`, err);
        });
        resolve(result);
      } catch (e) {
        saveLlmInteraction(sourceUrl, interactionId, text, { error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined }).catch(err => {
          console.error(`[EmbeddingCreator] Failed to save failed LLM interaction log for ${interactionId}:`, err);
        });
        reject(e);
      }
    });
  });
}

// Removed unused createEmbeddingsForChunks function
// export async function createEmbeddingsForChunks(...) { ... } 