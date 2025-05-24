import { categorizeWebsiteContent } from '@/lib/helpers/openai/functions/content-analysis';
import { CategorizedContent, CONFIDENCE_CONFIG } from '../../config';
import { logger } from '../logger';
import { validateConfidence, meetsConfidenceThreshold, logConfidence } from '../../utils';

/**
 * Categorizes text content using OpenAI
 * @param text Text to categorize
 * @param businessId Business ID for context
 * @param url Source URL for context
 * @returns Promise resolving to categorized content
 */
export async function categorizeText(text: string, businessId: string, url: string): Promise<CategorizedContent[]> {
  try {
    const result = await categorizeWebsiteContent(text, businessId, url);
    return result.map(content => {
      const validatedConfidence = validateConfidence(content.confidence || CONFIDENCE_CONFIG.DEFAULT_SCORE);
      logConfidence(content.category, validatedConfidence, 'categorization');
      return {
        ...content,
        confidence: validatedConfidence
      };
    }).filter(content => meetsConfidenceThreshold(content.confidence));
  } catch (error) {
    throw new Error(`Failed to categorize text: ${error instanceof Error ? error.message : String(error)}`);
  }
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
    // Skip empty or very short chunks
    if (!chunkText || chunkText.trim().length < 50) {
      throw new Error('Chunk too short to process');
    }

    const result = await categorizeWebsiteContent(chunkText, businessId, url);
    
    // Validate categorization results
    if (!result || result.length === 0) {
      throw new Error('No categories returned from categorization');
    }

    // Process and validate confidence scores
    const processedResults = result
      .map(section => ({
        ...section,
        confidence: validateConfidence(section.confidence || CONFIDENCE_CONFIG.DEFAULT_SCORE)
      }))
      .filter(section => {
        const meetsThreshold = meetsConfidenceThreshold(section.confidence);
        logConfidence(section.category, section.confidence, 'chunk-processing');
        return meetsThreshold;
      });

    if (processedResults.length === 0) {
      logger.logChunkFailed();
      throw new Error('No valid categories after confidence filtering');
    }

    categorizedSections.push(...processedResults);
    logger.logChunkProcessed();
    
    // Log each category processed
    processedResults.forEach(section => {
      logger.logCategoryProcessed(section.category);
    });
  } catch (error) {
    logger.logChunkFailed();
    throw error; // Propagate error for retry handling
  }
} 