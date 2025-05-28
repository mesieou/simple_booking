import * as path from 'path';
import { CrawlConfig, CrawlResult, PROCESS_CONTENT_CONFIG } from '@/lib/config/config';
import { LLMSegmentedChunk, segmentAndCategorizeByLLM } from './LLMSegmenterCategorizer';
import { preSplitByMarkdownAndSize } from './markdown-pre-splitter';
import { saveMarkdownPreChunk, saveMarkdownPreChunkManifest } from './logger-artifact-savers';
import { logger as globalLoggerInstance } from './logger'; // Assuming logger is in the same directory or adjust path

interface GenerateLlmSegmentedChunksParams {
  pagesToProcess: CrawlResult[];
  config: CrawlConfig;
  // mainLanguage: string; // Not directly used in the loop, segmentAndCategorizeByLLM might infer or get from config
}

/**
 * Iterates through successfully crawled pages, pre-splits their content,
 * and then segments/categorizes it using an LLM.
 * Also handles saving of intermediate artifacts like pre-chunks and their manifests.
 */
export async function generateLlmSegmentedChunksForAllPages({
  pagesToProcess,
  config,
}: GenerateLlmSegmentedChunksParams): Promise<LLMSegmentedChunk[]> {
  const allLlmSegmentedChunks: LLMSegmentedChunk[] = [];
  const maxCharsPerGptChunk = PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.MAX_CHARS_PER_LLM_INPUT_CHUNK;

  for (const result of pagesToProcess) {
    if (result.status === 'processed' && result.cleanedText && result.fullUrl) {
      try {
        const cleanedText = result.cleanedText;
        console.log(
          `[PageContentProcessor-HTML] Pre-splitting content for: ${result.fullUrl} (Original length: ${cleanedText.length} chars)`
        );

        const preChunks = preSplitByMarkdownAndSize(cleanedText, { maxCharsPerChunk: maxCharsPerGptChunk });
        console.log(
          `[PageContentProcessor-HTML] URL ${result.fullUrl} was pre-split into ${preChunks.length} chunk(s) for LLM processing.`
        );

        const savedPreChunkPaths: string[] = [];
        let llmSegmentedChunksFromThisUrl: LLMSegmentedChunk[] = [];

        for (let preChunkIndex = 0; preChunkIndex < preChunks.length; preChunkIndex++) {
          const preChunkContent = preChunks[preChunkIndex];
          const savedPath = saveMarkdownPreChunk(result.fullUrl, preChunkIndex, preChunkContent);
          if (savedPath) {
            savedPreChunkPaths.push(path.basename(savedPath));
          }

          console.log(
            `[PageContentProcessor-HTML] Segmenting and categorizing pre-chunk ${preChunkIndex + 1}/${preChunks.length} for: ${result.fullUrl} (Length: ${preChunkContent.length} chars)`
          );
          const segmentationResult = await segmentAndCategorizeByLLM(
            preChunkContent,
            result.fullUrl,
            result.pageTitle,
            config,
            preChunkIndex,
            preChunks.length
          );
          llmSegmentedChunksFromThisUrl.push(...segmentationResult.llmSegmentedChunks);
          console.log(
            `[PageContentProcessor-HTML] Pre-chunk ${preChunkIndex + 1}/${preChunks.length} for URL ${result.fullUrl} yielded ${segmentationResult.llmSegmentedChunks.length} LLM-defined sub-chunks.`
          );
        }

        const preChunksManifest = {
          sourceUrl: result.fullUrl,
          // Path assumes a specific output structure, might need adjustment if structure changes
          originalCleanedTextPath: `../../01_cleaned_text/cleaned.txt`,
          maxCharsPerGptChunk,
          numberOfPreChunks: preChunks.length,
          preChunkFileNames: savedPreChunkPaths,
          timestamp: new Date().toISOString(),
        };
        saveMarkdownPreChunkManifest(result.fullUrl, preChunksManifest);
        
        allLlmSegmentedChunks.push(...llmSegmentedChunksFromThisUrl);

      } catch (error) {
        console.error(
          `[PageContentProcessor-HTML] Failed to pre-split, segment, or categorize content for ${result.fullUrl}:`,
          error
        );
        await globalLoggerInstance.logUrlFailed(
          result.fullUrl,
          `Markdown pre-splitting or LLM segmentation/categorization failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }
  }
  return allLlmSegmentedChunks;
}

interface GenerateLlmSegmentedChunksForPdfPagesParams {
  pdfPagesToProcess: CrawlResult[];
  config: CrawlConfig;
}

/**
 * Iterates through successfully processed PDF pages and segments/categorizes their content using an LLM.
 * Each PDF page's text is treated as a single unit for the LLM segmenter.
 */
export async function generateLlmSegmentedChunksForPdfPages({
  pdfPagesToProcess,
  config,
}: GenerateLlmSegmentedChunksForPdfPagesParams): Promise<LLMSegmentedChunk[]> {
  const allPdfLlmSegmentedChunks: LLMSegmentedChunk[] = [];

  console.log(`[PageContentProcessor-PDF] Processing ${pdfPagesToProcess.length} PDF pages with LLM segmenter...`);

  for (const pageResult of pdfPagesToProcess) {
    if (!pageResult.cleanedText || pageResult.cleanedText.length === 0 || !pageResult.fullUrl) {
        console.warn(`[PageContentProcessor-PDF] Skipping page ${pageResult.fullUrl || 'unknown'} due to missing text or URL.`);
        continue;
    }

    try {
      console.log(`[PageContentProcessor-PDF] Segmenting content for: ${pageResult.fullUrl}`);
      const segmentationResult = await segmentAndCategorizeByLLM(
        pageResult.cleanedText,      
        pageResult.fullUrl,          
        pageResult.pageTitle,        
        config,
        0,                           
        1                            
      );
      allPdfLlmSegmentedChunks.push(...segmentationResult.llmSegmentedChunks);
      console.log(
        `[PageContentProcessor-PDF] PDF Page ${pageResult.fullUrl} yielded ${segmentationResult.llmSegmentedChunks.length} LLM-defined chunks.`
      );
    } catch (error) {
      console.error(
        `[PageContentProcessor-PDF] Failed to segment/categorize PDF page ${pageResult.fullUrl}:`,
        error
      );
      await globalLoggerInstance.logUrlFailed(
        pageResult.fullUrl,
        `LLM segmentation/categorization failed for PDF page: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
  return allPdfLlmSegmentedChunks;
}
