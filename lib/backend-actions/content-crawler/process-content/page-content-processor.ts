import * as path from 'path';
import { CrawlConfig, CrawlResult, PROCESS_CONTENT_CONFIG } from '@/lib/general-config/general-config';
import { LLMSegmentedChunk, segmentAndCategorizeByLLM } from './LLMSegmenterCategorizer';
import { preSplitByMarkdownAndSize } from './markdown-pre-splitter';
import { saveMarkdownPreChunk, saveMarkdownPreChunkManifest } from './logger-artifact-savers';
import { runConcurrentTasks } from '../content-crawler-utils';

export interface ProcessSinglePageForLlmChunksParams {
  pageResult: CrawlResult;
  config: CrawlConfig; // Contains type: 'pdf' | 'website_page'
  domain: string;      // To be added to each chunk
  sessionId: string;   // To be added to each chunk
}

export async function generateLlmSegmentedChunksForSinglePage(
  params: ProcessSinglePageForLlmChunksParams
): Promise<LLMSegmentedChunk[]> {
  const { pageResult, config, domain, sessionId } = params;

  const cleanedText = pageResult.cleanedText!;
  const fullUrl = pageResult.fullUrl!;
  const pageTitle = pageResult.pageTitle; // Optional

  const isPdf = config.type === 'pdf';
  const logPrefix = isPdf ? '[PageContentProcessor-PDFSingle]' : '[PageContentProcessor-HTMLSingle]';

  if (!cleanedText || !fullUrl) {
    console.warn(
      `${logPrefix} No content (cleanedText) or fullUrl for page. URL: ${fullUrl || 'Unknown URL'}. Skipping LLM chunk generation.`
    );
    return [];
  }

  console.log(
    `${logPrefix} Starting LLM chunk generation for page: ${fullUrl} (SID: ${sessionId}, Domain: ${domain})`
  );

  const maxCharsPerGptChunk = PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.MAX_CHARS_PER_LLM_INPUT_CHUNK;
  
  console.log(
    `${logPrefix} Pre-splitting content for: ${fullUrl} (Original length: ${cleanedText.length} chars)`
  );

  const preChunks = preSplitByMarkdownAndSize(cleanedText, { maxCharsPerChunk: maxCharsPerGptChunk });
  console.log(
    `${logPrefix} URL ${fullUrl} was pre-split into ${preChunks.length} chunk(s) for LLM processing.`
  );

  if (preChunks.length === 0) {
    console.warn(`${logPrefix} No pre-chunks generated for ${fullUrl}.`);
    return [];
  }

  const savedPreChunkPaths: string[] = [];

  const preChunkTasks = preChunks.map((preChunkContent, preChunkIndex) => async () => {
    const savedPath = saveMarkdownPreChunk(fullUrl, preChunkIndex, preChunkContent);
    if (savedPath) {
      savedPreChunkPaths.push(path.basename(savedPath));
    }

    console.log(
      `${logPrefix} Segmenting and categorizing pre-chunk ${preChunkIndex + 1}/${preChunks.length} for: ${fullUrl} (Length: ${preChunkContent.length} chars)`
    );

    try {
      const segmentationResult = await segmentAndCategorizeByLLM(
        preChunkContent,
        fullUrl,
        pageTitle,
        config,
        preChunkIndex
      );
      
      console.log(
        `${logPrefix} Pre-chunk ${preChunkIndex + 1}/${preChunks.length} for URL ${fullUrl} yielded ${segmentationResult.llmSegmentedChunks.length} LLM-defined sub-chunks.`
      );
      
      const augmentedChunks = segmentationResult.llmSegmentedChunks.map(chunk => ({
        ...chunk,
        domain: domain,
        sessionId: sessionId,
      }));
      
      return augmentedChunks;

    } catch (error) {
      console.error(
        `${logPrefix} Error segmenting/categorizing pre-chunk ${preChunkIndex + 1} for ${fullUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  });

  const preChunkConcurrency = Math.min(preChunks.length, 3);
  console.log(`${logPrefix} Processing ${preChunks.length} pre-chunks with concurrency ${preChunkConcurrency} for: ${fullUrl}`);

  const nestedAugmentedChunks = await runConcurrentTasks(
    async function*() { for (const task of preChunkTasks) yield task; }, 
    preChunkConcurrency
  );

  const finalLlmSegmentedChunks = nestedAugmentedChunks.flat();

  const preChunksManifest = {
    sourceUrl: fullUrl,
    originalCleanedTextPath: isPdf 
        ? `../../01_cleaned_text/cleaned_pdf_page.txt` 
        : `../../01_cleaned_text/cleaned.txt`,
    maxCharsPerGptChunk,
    numberOfPreChunks: preChunks.length,
    preChunkFileNames: savedPreChunkPaths,
    timestamp: new Date().toISOString(),
    sessionId: sessionId,
    domain: domain,
  };
  saveMarkdownPreChunkManifest(fullUrl, preChunksManifest);

  console.log(
    `${logPrefix} Finished LLM chunk generation for page: ${fullUrl}. Generated ${finalLlmSegmentedChunks.length} chunks.`
  );
  return finalLlmSegmentedChunks;
}
