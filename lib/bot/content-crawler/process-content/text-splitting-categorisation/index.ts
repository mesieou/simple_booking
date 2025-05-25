import { CategorizedContent, CATEGORY_DISPLAY_NAMES } from '../../config';
import { collectTextChunks } from './textSplitter';
import { processTextChunk } from './textCategorizer';
import { logger } from '../logger';

interface TextChunk {
  text: string;
  url: string;
  textIndex: number;
  metadata?: {
    chunkIndex: number;
    totalChunks: number;
    wordCount: number;
    charCount: number;
  };
}

const MAX_RETRIES = 3;

/**
 * Main function that orchestrates text splitting and categorization
 * @param texts Array of texts to process
 * @param businessId Business ID for context
 * @param urls Array of source URLs (one per text, or single URL for all)
 * @param chunkSize Maximum words per chunk
 * @param chunkOverlap Number of words to overlap between chunks
 * @returns Promise resolving to array of categorized content
 */
export async function textSplitterAndCategoriser(
  texts: string[],
  businessId: string,
  urls: string[],
  chunkSize = 2000,
  chunkOverlap = 100
): Promise<CategorizedContent[]> {
  const categorizedSections: CategorizedContent[] = [];
  let failedChunks: { chunk: TextChunk; retryCount: number; error: string }[] = [];

  const allChunks = collectTextChunks(texts, urls, chunkSize, chunkOverlap);
  logger.stats.totalChunks = allChunks.length; // Set correct total chunks

  const processChunk = async (chunk: TextChunk, retryCount: number = 0): Promise<CategorizedContent[]> => {
    const index = allChunks.indexOf(chunk);
    try {
      if (chunk.metadata && chunk.metadata.wordCount < 10) {
        logger.logChunk(index, chunk.url, 'failed', `Chunk too short (${chunk.metadata.wordCount} words)`);
        throw new Error(`Chunk too short (${chunk.metadata.wordCount} words)`);
      }
      const sections: CategorizedContent[] = [];
      await processTextChunk(
        chunk.text,
        businessId,
        chunk.url,
        sections,
        chunk.textIndex + 1,
        index,
        allChunks.length
      );
      // Only increment processed count once per chunk
      logger.logChunk(index, chunk.url, 'processed');
      sections.forEach(section => {
        logger.logCategory(CATEGORY_DISPLAY_NAMES[section.category], 'processed');
      });
      if (index === allChunks.length - 1 || allChunks[index + 1]?.url !== chunk.url) {
        logger.logUrl(chunk.url, 'processed');
      }
      return sections;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (retryCount < MAX_RETRIES) {
        return processChunk(chunk, retryCount + 1);
      } else {
        logger.logChunk(index, chunk.url, 'failed', errorMessage);
        failedChunks.push({ 
          chunk, 
          retryCount,
          error: errorMessage
        });
        return [];
      }
    }
  };

  const results = await Promise.all(allChunks.map(chunk => processChunk(chunk)));
  const allSections = results.flat();
  categorizedSections.push(...allSections);
  logger.printDetailedTables();
  return categorizedSections;
} 