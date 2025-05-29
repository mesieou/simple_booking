import { generateEmbedding } from '@/lib/helpers/openai/functions/embeddings';
import { scheduleTask } from '@/lib/helpers/openai/rate-limiter';
import { saveLlmInteraction } from '../logger-artifact-savers';

/**
 * Generates an embedding for the given text, handling OpenAI queueing and interaction logging.
 * @param text The text content to embed.
 * @param sourceUrl The source URL of the content, for logging purposes.
 * @param interactionBaseId A base ID for creating unique interaction logs.
 * @param estimatedTokens Optional estimated token count for task scheduling.
 * @returns A Promise resolving to the embedding vector (number[]), or rejecting on error.
 */
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
      return result; 
    } catch (e) {
      console.error(`[EmbeddingCreator] generateEmbedding THREW for ${interactionId}, sourceUrl: ${sourceUrl}. Error:`, e);
      throw e; 
    }
  };
  
  return scheduleTask(taskToSchedule, estimatedTokens);
}

// Removed unused createEmbeddingsForChunks function
// export async function createEmbeddingsForChunks(...) { ... } 