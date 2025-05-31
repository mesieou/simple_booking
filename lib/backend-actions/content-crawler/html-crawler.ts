// import * as path from 'path';
import { CrawlConfig, CrawlProcessingResult, CrawlResult, CrawlOutput, USER_AGENT } from '@/lib/general-config/general-config'; // defaultConfig removed as it's not used
import type { LLMSegmentedChunk } from './process-content/LLMSegmenterCategorizer';
import {
  initializeContentProcessing,
  processAndEmbedChunksPerPage,
  finalizeContentProcessing
} from './process-content/grouping-storing-content';
import { detectLanguage } from './content-crawler-utils';
import { crawlWebsiteForLinks } from './url-fetcher/links-fetcher/crawlManager';
import { cleanAndExtractMainContent } from './url-fetcher/htmlCleaner';
import { logger as globalLoggerInstance } from './process-content/logger';
import { fetchAndParseRobotsTxt, isUrlAllowed, RobotsRules } from './url-fetcher/robotsParser';
import { processUrlsConcurrently } from './url-fetcher/page-processor';
import {
  generateLlmSegmentedChunksForSinglePage
} from './process-content/page-content-processor';
import { initializeCrawlerEnvironment } from './crawler-setup';
import * as crypto from 'crypto'; // Added for UUID generation

/**
 * Fetches the content of the given page URL and detects its primary language.
 * @param pageUrl The URL of the page to analyze.
 * @param languageDetectionConfig Configuration for language detection hints.
 * @returns The detected language code (e.g., 'en') or 'unknown' if detection fails.
 */
async function _detectMainSiteLanguage(
  pageUrl: string,
  languageDetectionConfig: {
    importantUrls?: string[];
    urlLanguageHints?: Record<string, string>;
  }
): Promise<string> {
  try {
    // Attempt to fetch the page content.
    const response = await fetch(pageUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (response.ok) {
      const htmlContent = await response.text();
      // Clean the HTML and extract text content.
      const { allExtractedText: cleanedText } = cleanAndExtractMainContent(htmlContent);
      if (cleanedText) {
        // Detect language from the cleaned text.
        return detectLanguage(pageUrl, cleanedText, {
            importantUrls: languageDetectionConfig.importantUrls,
            urlLanguageHints: languageDetectionConfig.urlLanguageHints
        });
      }
    }
    // Log a warning if fetching or content extraction was not successful.
    console.warn(`[HTML Crawler] Could not fetch or process URL ${pageUrl} for language detection (response not OK or no text).`);
  } catch (error) {
    // Log any error during the fetch or processing.
    console.warn(`[HTML Crawler] Error fetching or processing URL ${pageUrl} for language detection:`, error);
  }
  return 'unknown'; // Default language if detection fails for any reason.
}

/**
 * Orchestrates the website crawling process: fetches links, filters by robots.txt, 
 * detects main language, and processes individual pages to extract content.
 * @param config The configuration for the crawl.
 * @returns A promise that resolves to the crawl output, including results for each page and the main site language.
 */
export const crawlWebsite = async (config: CrawlConfig): Promise<CrawlOutput> => {
  const { websiteUrl: initialWebsiteUrl } = config;

  // Ensure websiteUrl is provided in the configuration.
  if (!initialWebsiteUrl) {
    throw new Error('websiteUrl is required for HTML crawling');
  }
  const websiteUrl = initialWebsiteUrl; // Use a consistent variable name throughout the function.

  // Fetch and parse robots.txt rules for the target website.
  const robotsRules: RobotsRules | null = await fetchAndParseRobotsTxt(websiteUrl);

  // Discover all links on the website, respecting initial depth, skips, and other configurations.
  const { allFoundAbsoluteUrls, processableUniqueAbsoluteUrls } = await crawlWebsiteForLinks(config, robotsRules);
  // Log all discovered URLs for auditing or debugging purposes.
  await globalLoggerInstance.recordDiscoveredUrls(Array.from(new Set([websiteUrl, ...allFoundAbsoluteUrls])));

  // Prepare the initial list of unique URLs to consider for processing (includes the root URL).
  const uniqueUrlsToConsider = Array.from(new Set([websiteUrl, ...processableUniqueAbsoluteUrls]));
  
  // Filter these URLs against the fetched robots.txt rules.
  const allowedUrlsToProcess = uniqueUrlsToConsider.filter(url =>
    isUrlAllowed(url, robotsRules, websiteUrl)
  );

  // Handle cases where no URLs are allowed by robots.txt, including the root URL.
  if (allowedUrlsToProcess.length === 0) {
    const rootAllowed = isUrlAllowed(websiteUrl, robotsRules, websiteUrl);
    console.warn(`[HTML Crawler] No URLs to process after robots.txt filtering. Root was: ${rootAllowed ? 'allowed' : 'disallowed'}. Initial processable: ${processableUniqueAbsoluteUrls.length}`);
    if (!rootAllowed && uniqueUrlsToConsider.includes(websiteUrl)) {
        await globalLoggerInstance.logUrlSkipped(websiteUrl, 'disallowed by robots.txt (root)');
    }
    return { results: [], urls: [], mainLanguage: 'unknown' }; // Return empty output if no URLs can be processed.
  }
  
  // Initialize collections for tracking crawl results, processed URLs, and content signatures to avoid duplicates.
  const crawlResults: CrawlResult[] = [];
  const processedUrlTasks = new Set<string>(); // Tracks URLs for which processing has been initiated.
  const processedContentSignatures = new Set<string>(); // Tracks content hashes to avoid processing duplicate content.

  const domain = new URL(websiteUrl).hostname; // Extract domain for context or logging.

  // Detect the primary language of the website by analyzing the root page.
  let mainLanguage = await _detectMainSiteLanguage(websiteUrl, {
    importantUrls: config.importantUrlsForDetection,
    urlLanguageHints: config.urlLanguageHintsForDetection
  });
  console.log(`[HTML Crawler] Site's primary reference language (from root): ${mainLanguage}`);

  // Process all allowed URLs concurrently to fetch, clean, and extract their main content.
  await processUrlsConcurrently({
    urlsToProcess: allowedUrlsToProcess,
    websiteUrl,
    robotsRules,
    config,
    crawlResults,
    processedUrlTasks,
    processedContentSignatures,
    mainLanguage,
    domain
  });
  
  // Collect all URLs for which processing was attempted (either successfully or with errors).
  const attemptedUrls = Array.from(processedUrlTasks);

  // Return the aggregated crawl results, list of all attempted URLs, and the detected main language.
  return {
    results: crawlResults,
    urls: attemptedUrls,
    mainLanguage
  };
};

/**
 * Processes the HTML content obtained from `crawlWebsite`: generates LLM-friendly text chunks,
 * categorizes them, and prepares them for embedding or further use.
 * @param config The configuration for content processing.
 * @param crawlOutput The output from the `crawlWebsite` function.
 * @returns A promise that resolves to the processed content result, including merged text and embedding status.
 */
export const processHtmlContent = async (config: CrawlConfig, crawlOutput: CrawlOutput): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> => {
  const { results, mainLanguage: siteMainLanguage } = crawlOutput; // Extract results and mainLanguage
  const llmChunkGenSessionId = crypto.randomUUID(); // UUID for LLM chunk generation (logging, tracing)
  const domain = config.websiteUrl ? new URL(config.websiteUrl).hostname : 'unknown_domain';

  console.log(`[HTML Crawler] Starting content processing. LLM Chunk Gen Session: ${llmChunkGenSessionId}, Domain: ${domain}`);

  // Determine processedPageUrls and processedRootUrls for session initialization
  const processedPageUrls = results.map(r => r.fullUrl); // All URLs that were attempted for fetching/cleaning stage
  const successfullyProcessedRootUrls = results
    .filter(r => r.fullUrl === config.websiteUrl && r.status === 'processed')
    .map(r => r.fullUrl);

  // Initialize content processing (DB session, processing state)
  const { 
    sessionId: dbSessionId, 
    processingState, 
    sessionInstance 
  } = await initializeContentProcessing(config, processedPageUrls, successfullyProcessedRootUrls);

  console.log(`[HTML Crawler] DB Session initialized: ${dbSessionId}. ProcessingState created.`);

  const allLlmSegmentedChunks: LLMSegmentedChunk[] = [];
  const successfullyProcessedPages = results.filter(r => r.status === 'processed');

  if (successfullyProcessedPages.length === 0) {
    console.warn('[HTML Crawler] No successfully processed pages found in crawlOutput. Skipping LLM chunk generation and embedding.');
  } else {
    console.log(`[HTML Crawler] Processing ${successfullyProcessedPages.length} successfully crawled pages for LLM chunks and embedding.`);
    for (const pageResult of successfullyProcessedPages) {
      if (!pageResult.cleanedText || !pageResult.fullUrl) {
        console.warn(
          `[HTML Crawler] Skipping page ${pageResult.url} for LLM chunking due to missing cleanedText or fullUrl.`
        );
        continue;
      }
      try {
        console.log(`[HTML Crawler] Generating LLM chunks for page: ${pageResult.fullUrl} (LLM Chunk Gen SID: ${llmChunkGenSessionId})`);
        const chunksFromPage = await generateLlmSegmentedChunksForSinglePage({
          pageResult,
          config,
          domain,
          sessionId: llmChunkGenSessionId, // Use the UUID for this part
        });
        
        if (chunksFromPage.length > 0) {
          allLlmSegmentedChunks.push(...chunksFromPage);
          console.log(`[HTML Crawler] Generated ${chunksFromPage.length} LLM chunks for ${pageResult.fullUrl}.`);
          // Now process and embed these chunks for the current page
          await processAndEmbedChunksPerPage(chunksFromPage, config, dbSessionId, processingState);
          console.log(`[HTML Crawler] Submitted ${chunksFromPage.length} chunks from ${pageResult.fullUrl} for embedding and DB processing (DB SID: ${dbSessionId}).`);
        } else {
          console.log(`[HTML Crawler] No LLM chunks generated for ${pageResult.fullUrl}.`);
        }
      } catch (error) {
        console.error(`[HTML Crawler] Error processing page ${pageResult.fullUrl} for LLM chunks or embedding:`, error);
      }
    }
  }

  if (allLlmSegmentedChunks.length === 0) {
    console.warn('[HTML Crawler] No content was successfully segmented by LLM after processing all pages.');
    // Finalize even if no chunks, to close session correctly if it was opened
    if (dbSessionId) {
        await finalizeContentProcessing(processingState, sessionInstance);
    }
    return {
        mergedText: '', pageCount: 0, uniqueParagraphs: 0,
        businessId: config.businessId!, source: config.websiteUrl!,
        embeddingsStatus: 'No LLM-segmented chunks to process'
    };
  }

  // All page-by-page processing is done. Now finalize the entire batch.
  const finalStatus = await finalizeContentProcessing(processingState, sessionInstance);
  console.log(`[HTML Crawler] Content processing finalized. Final status/session ID: ${finalStatus}`);

  await globalLoggerInstance.logSummary();

  const mergedText = allLlmSegmentedChunks.map(chunk => chunk.chunkText).join('\n\n\n');
  const finalValidProcessedPageUrls = Array.from(new Set(allLlmSegmentedChunks.map(chunk => chunk.sourceUrl)));

  return {
    mergedText: mergedText,
    pageCount: finalValidProcessedPageUrls.length,
    uniqueParagraphs: allLlmSegmentedChunks.length,
    businessId: config.businessId!,
    source: config.websiteUrl!,
    embeddingsStatus: `Processed with DB Session ID: ${dbSessionId}`, 
  };
};

/**
 * Main entry point for the crawling and processing workflow.
 * Initializes the crawler environment, crawls the website, and then processes the extracted content.
 * @param config The configuration for the entire crawl and process operation.
 * @returns A promise that resolves to the final processed content result, including embedding status.
 */
export const crawlAndProcess = async (config: CrawlConfig): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> => {
  console.log('[HTML Crawler ENTRY] crawlAndProcess received config.websiteUrl:', config.websiteUrl);
  // Initialize any necessary global state or services for the crawler (e.g., logger).
  await initializeCrawlerEnvironment();

  // Perform the website crawl to fetch and initially process pages based on the config.
  const crawlOutput = await crawlWebsite(config);

  // Filter results to find successfully processed pages.
  const successfullyProcessedResults = crawlOutput.results.filter(r => r.status === 'processed');
  // If no pages were successfully processed during the crawl, skip the content processing stage.
  if (!crawlOutput || successfullyProcessedResults.length === 0) {
    console.warn('[HTML Crawler] No pages were successfully processed by crawlWebsite. Skipping content processing stage.');
    // Log summary even if aborting early, if logger is initialized.
    if(globalLoggerInstance.isInitialized) await globalLoggerInstance.logSummary();
    return {
        mergedText: '', pageCount: 0, uniqueParagraphs: 0,
        businessId: config.businessId!, source: config.websiteUrl || 'unknown',
        embeddingsStatus: 'No pages processed to segment'
    };
  }

  // If crawl was successful and produced results, proceed to process the HTML content.
  return processHtmlContent(config, crawlOutput);
};
