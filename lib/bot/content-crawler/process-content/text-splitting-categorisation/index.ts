import { CategorizedContent } from '../../config';
import { runConcurrentTasks } from '../../utils';
import { collectTextChunks } from './textSplitter';
import { processTextChunk } from './textCategorizer';

/**
 * Main function that orchestrates text splitting and categorization
 * @param texts Array of texts to process
 * @param businessId Business ID for context
 * @param urls Array of source URLs (one per text, or single URL for all)
 * @param chunkSize Maximum words per chunk
 * @param chunkOverlap Number of words to overlap between chunks
 * @param gptConcurrency Number of parallel GPT calls
 * @returns Promise resolving to array of categorized content
 */
export async function textSplitterAndCategoriser(
  texts: string[],
  businessId: string,
  urls: string[],
  chunkSize = 2000,
  chunkOverlap = 100,
  gptConcurrency = 10
): Promise<CategorizedContent[]> {
  const categorizedSections: CategorizedContent[] = [];
  let processedCount = 0;

  const allChunks = collectTextChunks(texts, urls, chunkSize, chunkOverlap);
  console.log(`[Text Categorizer] Processing ${allChunks.length} chunks from ${texts.length} texts`);

  // Process chunks with GPT in parallel
  async function* categorizeChunksInParallel() {
    for (let i = 0; i < allChunks.length; i++) {
      yield async () => {
        const { text, url, textIndex } = allChunks[i];
        processedCount++;
        const percent = Math.round((processedCount / allChunks.length) * 100);
        console.log(`[Text Categorizer] Processing chunk ${processedCount}/${allChunks.length} (${percent}%) from text ${textIndex + 1}`);
        
        await processTextChunk(
          text,
          businessId,
          url,
          categorizedSections,
          textIndex + 1,
          i,
          allChunks.length
        );
      };
    }
  }

  await runConcurrentTasks(categorizeChunksInParallel, gptConcurrency);
  console.log(`[Text Categorizer] Completed. Processed ${processedCount} chunks`);
  return categorizedSections;
} 