import { pushToQueue } from '@/lib/helpers/openai/rate-limiter';
import { categorizeWebsiteContent } from '@/lib/helpers/openai/functions/content-analysis';
import { CategorizedContent } from '../../config';

/**
 * Wraps the categorization function in the OpenAI queue for rate limiting
 * @param text Text to categorize
 * @param businessId Business ID for context
 * @param url Source URL for context
 * @returns Promise resolving to categorized content
 */
export function categorizeInQueue(text: string, businessId: string, url: string): Promise<CategorizedContent[]> {
  return new Promise<CategorizedContent[]>((resolve, reject) => {
    pushToQueue(async () => {
      try {
        const result = await categorizeWebsiteContent(text, businessId, url);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Processes a single text chunk for categorization
 * @param chunkText Text chunk to process
 * @param businessId Business ID for context
 * @param url Source URL for context
 * @param categorizedSections Array to store results
 * @param workerId Worker identifier for logging
 * @param chunkIdx Chunk index for logging
 * @param totalChunks Total number of chunks for logging
 */
export async function processTextChunk(
  chunkText: string,
  businessId: string,
  url: string,
  categorizedSections: CategorizedContent[],
  workerId: number,
  chunkIdx: number,
  totalChunks: number
): Promise<void> {
  try {
    const result = await categorizeInQueue(chunkText, businessId, url);
    categorizedSections.push(...result);
    console.log(`[Text Categorizer] Worker ${workerId} completed chunk ${chunkIdx + 1}/${totalChunks}`);
  } catch (error) {
    console.error(`[Text Categorizer] Worker ${workerId} error in chunk ${chunkIdx + 1}/${totalChunks}:`, error);
  }
} 