import { Embedding } from '@/lib/models/embeddings';
import { EMBEDDING_CONFIG, ContentChunk } from '@/lib/config/config';
import { generateEmbedding } from '@/lib/helpers/openai/functions/embeddings';
import { scheduleTask } from '@/lib/helpers/openai/rate-limiter';
import { retry } from 'ts-retry-promise';
import { logger } from '@/lib/bot/content-crawler/process-content/logger';
import { saveLlmInteraction } from '../logger-artifact-savers';

// Helper to wrap generateEmbedding in the OpenAI queue
export function embeddingInQueue(
  text: string, 
  sourceUrl: string,
  interactionBaseId: string,
  estimatedTokens?: number
): Promise<number[]> {
  
  const taskToSchedule = async (): Promise<number[]> => {
    const interactionId = `${interactionBaseId}_embedding`;
    try {
      console.log(`[EmbeddingCreator] Calling generateEmbedding for: ${sourceUrl}, interactionId: ${interactionId}, text (first 80 chars): "${text.substring(0, 80).replace(/\n/g, ' ')}..."`);
      const result = await generateEmbedding(text); 
      console.log(`[EmbeddingCreator] generateEmbedding SUCCEEDED for ${interactionId}. Result vector (first 3 elements):`, result ? result.slice(0,3) : result);
      saveLlmInteraction(sourceUrl, interactionId, text, { vectorSample: result ? result.slice(0,3) : null }).catch(err => {
        console.error(`[EmbeddingCreator] Failed to save LLM interaction log for ${interactionId}:`, err);
      });
      return result; 
    } catch (e) {
      console.error(`[EmbeddingCreator] generateEmbedding THREW for ${interactionId}, sourceUrl: ${sourceUrl}. Error:`, e);
      saveLlmInteraction(sourceUrl, interactionId, text, { error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined }).catch(err => {
        console.error(`[EmbeddingCreator] Failed to save failed LLM interaction log for ${interactionId}:`, err);
      });
      throw e; 
    }
  };
  
  return scheduleTask(taskToSchedule, estimatedTokens);
}

// Removed unused createEmbeddingsForChunks function
// export async function createEmbeddingsForChunks(...) { ... } 