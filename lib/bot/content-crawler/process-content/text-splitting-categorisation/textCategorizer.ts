import { categorizeWebsiteContent } from '@/lib/helpers/openai/functions/content-analysis';
import { CategorizedContent, CONFIDENCE_CONFIG, CATEGORY_DISPLAY_NAMES, Category, PROCESS_CONTENT_CONFIG, CrawlConfig } from '@/lib/config/config';
import { validateConfidence, logConfidence } from '@/lib/bot/content-crawler/utils';
import {
    savePdfCategorizationPrompt, savePdfCategorizationResponse,
    saveUrlCategorizationPrompt, saveUrlCategorizationResponse
} from '../logger-artifact-savers';
import { logger } from '../logger';

/**
 * Processes a single text chunk for categorization
 * @param chunkText Text chunk to process
 * @param businessId Business ID for context
 * @param url Source URL for context
 * @param pageTitle Page title for context
 * @param categorizedSections Array to store results
 * @param chunkIdx Chunk index for logging
 * @param config CrawlConfig for context
 */
export async function processTextChunk(
  chunkText: string,
  businessId: string,
  url: string,
  pageTitle: string | undefined,
  categorizedSections: CategorizedContent[],
  chunkIdx: number,
  config: CrawlConfig
): Promise<void> {
  try {
    const shortChunkMsg = PROCESS_CONTENT_CONFIG.TEXT_CATEGORIZER.ERROR_MESSAGES.CHUNK_TOO_SHORT;
    // Skip empty or very short chunks
    if (!chunkText || chunkText.trim().length < PROCESS_CONTENT_CONFIG.TEXT_CATEGORIZER.MIN_CHUNK_LENGTH) {
      await logger.logChunkSkipped(url, chunkIdx, shortChunkMsg);
      return; // Exit early, this is not a retryable failure but a filter condition
    }

    let apiOutput;
    try {
      apiOutput = await categorizeWebsiteContent(chunkText, businessId, url) as unknown as { prompt: string, result: CategorizedContent[] };
    } catch (categorizationError: any) {
      // Catch errors directly from categorizeWebsiteContent, especially SSL/network issues
      const message = categorizationError.message || '';
      const code = categorizationError.code || (categorizationError.cause ? categorizationError.cause.code : '');
      
      if (code === 'ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC' || message.includes('SSL') || message.includes('TLS') || message.includes('socket hang up') || message.includes('ECONNRESET')) {
        const specificErrorMessage = `Chunk failed due to critical network/SSL error during OpenAI API call: ${message} (Code: ${code})`;
        console.error(`[Critical API Error] ${specificErrorMessage} for URL: ${url}, Chunk: ${chunkIdx}`);
        await logger.logChunk(chunkIdx, url, 'failed', specificErrorMessage); // Log as terminally failed
        return; // Exit and do not retry for these critical errors
      } else {
        // For other errors from categorizeWebsiteContent, rethrow to allow standard retry via index.ts
        throw categorizationError;
      }
    }
    
    const { prompt: llmPrompt, result: categorizationResultUnprocessed } = apiOutput;
    
    // Log the prompt and the categorization response
    const isPdf = url.startsWith('pdf:');
    const identifier = `chunk_${chunkIdx}`; // Default identifier for URL based logs

    if (isPdf) {
      const pdfMarker = '#page=';
      const pageMarkerIndex = url.indexOf(pdfMarker);
      if (pageMarkerIndex !== -1) {
        const pdfNamePart = url.substring(4, pageMarkerIndex);
        const pageNumberPart = url.substring(pageMarkerIndex + pdfMarker.length);
        const pageNumber = parseInt(pageNumberPart, 10);
        if (!isNaN(pageNumber)) {
          const pdfIdentifier = `page_${pageNumber}_chunk_${chunkIdx}`;
          savePdfCategorizationPrompt(pdfNamePart, pdfIdentifier, llmPrompt);
          savePdfCategorizationResponse(pdfNamePart, pdfIdentifier, categorizationResultUnprocessed);
        } else {
          console.error(`Could not parse page number from PDF URL: ${url} for categorization logging`);
          saveUrlCategorizationPrompt(url, chunkIdx, llmPrompt);
          saveUrlCategorizationResponse(url, chunkIdx, categorizationResultUnprocessed);
        }
      } else {
        console.error(`PDF URL format error: ${url} - could not find ${pdfMarker} for categorization logging`);
        saveUrlCategorizationPrompt(url, chunkIdx, llmPrompt);
        saveUrlCategorizationResponse(url, chunkIdx, categorizationResultUnprocessed);
      }
    } else {
      saveUrlCategorizationPrompt(url, chunkIdx, llmPrompt);
      saveUrlCategorizationResponse(url, chunkIdx, categorizationResultUnprocessed);
    }

    // Validate categorization results
    if (!categorizationResultUnprocessed || categorizationResultUnprocessed.length === 0) {
      // If categorizeWebsiteContent itself returned empty results (e.g. OpenAI API error, parse error handled within)
      // We should log this as a failed chunk, but it might not be retryable if the function handles its own errors by returning [].
      // The original code threw an error here, which would be caught by the retry mechanism in index.ts.
      // Let's ensure it's logged as failed if empty and then re-throw to allow retries if appropriate.
      const errorMsg = PROCESS_CONTENT_CONFIG.TEXT_CATEGORIZER.ERROR_MESSAGES.NO_CATEGORIES;
      await logger.logChunkFailed(url, chunkIdx, errorMsg); 
      throw new Error(errorMsg);
    }

    const processedResults = categorizationResultUnprocessed.map(section => ({
      ...section,
      url: url,
      pageTitle: pageTitle,
      confidence: validateConfidence(section.confidence || CONFIDENCE_CONFIG.DEFAULT_SCORE),
      confidenceReason: section.confidenceReason
    }));

    if (processedResults.length === 0) {
      const errorMsg = PROCESS_CONTENT_CONFIG.TEXT_CATEGORIZER.ERROR_MESSAGES.NO_VALID_CATEGORIES;
      await logger.logChunkFailed(url, chunkIdx, errorMsg);
      throw new Error(errorMsg);
    }

    categorizedSections.push(...processedResults);
    // logger.logChunkProcessed(url, chunkIdx); // Removed redundant: Logged as processed by the calling orchestrator in index.ts
    // Log each category processed
    for (const section of processedResults) {
      await logger.logCategoryProcessed(CATEGORY_DISPLAY_NAMES[section.category as Category]);
    }
  } catch (error: any) { // Catching 'any' to inspect error.code
    // This outer catch is now primarily for errors rethrown from within the 'try' block (e.g., NO_CATEGORIES)
    // or errors from categorizeWebsiteContent that were not critical network/SSL issues.
    // These will be handled by the retry mechanism in text-splitting-categorisation/index.ts.
    // The critical SSL/network errors are handled and returned from within the inner try-catch.
    throw error; 
  }
} 