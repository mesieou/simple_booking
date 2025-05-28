import { CategorizedContent, CATEGORY_DISPLAY_NAMES, PROCESS_CONTENT_CONFIG, CrawlConfig, defaultConfig, TextChunk } from '@/lib/config/config';
import { collectTextChunks, TextChunkInput } from './textSplitter';
import { processTextChunk } from './textCategorizer';
import { logger } from '@/lib/bot/content-crawler/process-content/logger';
import { runConcurrentTasks } from '../../utils';
import { saveUrlChunks } from '../logger-artifact-savers';
import crypto from 'crypto';

/**
 * Main function that orchestrates text splitting and categorization
 * @param texts Array of texts to process
 * @param businessId Business ID for context
 * @param urls Array of source URLs (one per text, or single URL for all)
 * @param config CrawlConfig
 * @param chunkSize Maximum words per chunk
 * @param chunkWordOverlap Number of words to overlap between chunks (used for word-based overlap)
 * @returns Promise resolving to array of categorized content
 */
export async function textSplitterAndCategoriser(
  texts: string[],
  urls: string[],
  config: CrawlConfig,
  chunkSize: number = PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.DEFAULT_CHUNK_SIZE,
  chunkWordOverlap: number = PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.DEFAULT_CHUNK_OVERLAP
): Promise<{ categorizedSections: CategorizedContent[]; allGeneratedChunks: TextChunk[] }> {
  const categorizedSectionsCollector: CategorizedContent[] = [];
  let failedChunks: { chunk: TextChunk; retryCount: number; error: string }[] = [];

  const chunkInputs: TextChunkInput[] = texts.map((text, index) => ({
    text: text,
    pageUrl: urls.length === 1 ? urls[0] : urls[index],
    blockIndexInPage: index,
    totalBlocksOnPage: texts.length,
  }));

  const sentenceOverlap = config.sentenceOverlap ?? PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.DEFAULT_SENTENCE_OVERLAP;

  const allChunks = await collectTextChunks(
    chunkInputs,
    chunkSize,
    sentenceOverlap,
    chunkWordOverlap
  );
  await logger.addTotalChunks(allChunks.length);

  const chunksByUrl: Record<string, TextChunk[]> = {};
  for (const chunk of allChunks) {
    if (!chunksByUrl[chunk.sourcePageUrl]) {
      chunksByUrl[chunk.sourcePageUrl] = [];
    }
    chunksByUrl[chunk.sourcePageUrl].push(chunk);
  }

  // Save all generated chunks to files, grouped by URL
  for (const [sourceUrl, chunksForThisUrl] of Object.entries(chunksByUrl)) {
    // Construct a simple ID for each chunk for the JSON artifact
    const chunksToSave = chunksForThisUrl.map((chunk, idx) => ({
      // Use direct properties of TextChunk for ID generation
      id: `chunk_${chunk.sourceBlockIndex}_${chunk.chunkInBlockIndex}_${idx}`,
      text: chunk.text,
      // Pass all top-level properties of the chunk (excluding text and id already handled)
      // and its existing metadata object for comprehensive artifact saving.
      sourcePageUrl: chunk.sourcePageUrl, 
      sourceBlockIndex: chunk.sourceBlockIndex,
      sourcePageTitle: chunk.sourcePageTitle,
      chunkInBlockIndex: chunk.chunkInBlockIndex,
      totalChunksInBlock: chunk.totalChunksInBlock,
      pageLang: chunk.pageLang,
      pageExtractedPatterns: chunk.pageExtractedPatterns,
      metadata: chunk.metadata 
    }));
    await saveUrlChunks(sourceUrl, chunksToSave);
  }

  const processChunk = async (chunk: TextChunk, retryCount: number = 0): Promise<CategorizedContent[]> => {
    const index = allChunks.indexOf(chunk); // Overall index of the chunk
    try {
      if (chunk.metadata && chunk.metadata.wordCount < PROCESS_CONTENT_CONFIG.LOGGER.MIN_CHUNK_WORDS) {
        const errorMessage = PROCESS_CONTENT_CONFIG.TEXT_CATEGORIZER.ERROR_MESSAGES.CHUNK_TOO_SHORT_WORDS(chunk.metadata.wordCount);
        await logger.logChunk(index, chunk.sourcePageUrl, 'skipped', errorMessage);
        failedChunks.push({ chunk, retryCount: PROCESS_CONTENT_CONFIG.LOGGER.MAX_RETRIES, error: errorMessage });
        return [];
      }
      const sectionsForThisChunk: CategorizedContent[] = [];
      await processTextChunk(
        chunk.text,
        config.businessId,
        chunk.sourcePageUrl,
        chunk.sourcePageTitle, // Pass sourcePageTitle directly from chunk
        sectionsForThisChunk,
        index, // Pass overall chunk index
        config
      );
      await logger.logChunk(index, chunk.sourcePageUrl, 'processed', 'Chunk processed successfully');
      for (const section of sectionsForThisChunk) {
        await logger.logCategoryProcessed(CATEGORY_DISPLAY_NAMES[section.category]);
      }
      return sectionsForThisChunk;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (retryCount < PROCESS_CONTENT_CONFIG.LOGGER.MAX_RETRIES) {
        return processChunk(chunk, retryCount + 1);
      }
      await logger.logChunk(index, chunk.sourcePageUrl, 'failed', errorMessage);
      failedChunks.push({ 
        chunk, 
        retryCount,
        error: errorMessage
      });
      return [];
    }
  };

  const categorizationConcurrency = config.concurrency ?? defaultConfig.concurrency;

  function taskGenerator(): AsyncGenerator<() => Promise<CategorizedContent[]>> {
    return (async function*() {
      for (const chunk of allChunks) {
        yield async () => processChunk(chunk);
      }
    })();
  }

  const resultsArray: CategorizedContent[][] = await runConcurrentTasks(taskGenerator, categorizationConcurrency);
  
  const allSuccessfullyCategorizedSections = resultsArray.flat();
  categorizedSectionsCollector.push(...allSuccessfullyCategorizedSections);

  if (failedChunks.length > 0) {
    console.warn(`[textSplitterAndCategoriser] ${failedChunks.length} out of ${allChunks.length} chunks failed final processing after retries.`);
  }

  return { categorizedSections: categorizedSectionsCollector, allGeneratedChunks: allChunks };
} 