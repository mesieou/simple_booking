import * as fs from 'fs';
import * as path from 'path';
import { CrawlConfig, CrawlProcessingResult, CrawlResult, CrawlOutput, defaultConfig, URL_FETCHER_CONFIG, USER_AGENT, ExtractedPatterns } from '@/lib/config/config';
import { segmentAndCategorizeByLLM, LLMSegmentedChunk } from './process-content/LLMSegmenterCategorizer';
import { processContent as processContentWithGrouping } from './process-content/grouping-storing-content';
import { detectLanguage } from './utils';
import { crawlWebsiteForLinks } from './url-fetcher/links-fetcher/crawlManager';
import { cleanAndExtractMainContent } from './url-fetcher/htmlCleaner';
import { logger as globalLoggerInstance } from '@/lib/bot/content-crawler/process-content/logger';
import { fetchAndParseRobotsTxt, isUrlAllowed, RobotsRules } from './url-fetcher/robotsParser';
import { preSplitByMarkdownAndSize } from './process-content/markdown-pre-splitter';
import { saveMarkdownPreChunk, saveMarkdownPreChunkManifest } from './process-content/logger-artifact-savers';
import { processUrlsConcurrently } from './url-fetcher/page-processor';

export const crawlWebsite = async (config: CrawlConfig): Promise<CrawlOutput> => {
  const { websiteUrl: initialWebsiteUrl } = config;

  if (!initialWebsiteUrl) {
    throw new Error('websiteUrl is required for HTML crawling');
  }
  const websiteUrl = initialWebsiteUrl;

  const robotsRules: RobotsRules | null = await fetchAndParseRobotsTxt(websiteUrl);
  const { allFoundAbsoluteUrls, processableUniqueAbsoluteUrls } = await crawlWebsiteForLinks(config, robotsRules);
  await globalLoggerInstance.recordDiscoveredUrls(Array.from(new Set([websiteUrl, ...allFoundAbsoluteUrls])));

  const uniqueUrlsToProcessInitially = Array.from(new Set([websiteUrl, ...processableUniqueAbsoluteUrls]));
  
  const trulyProcessableUrls = uniqueUrlsToProcessInitially.filter(url =>
    isUrlAllowed(url, robotsRules, websiteUrl)
  );

  if (trulyProcessableUrls.length === 0) {
    const rootAllowed = isUrlAllowed(websiteUrl, robotsRules, websiteUrl);
    console.warn(`[HTML Crawler] No URLs to process after robots.txt filtering (including root). Root was: ${rootAllowed ? 'allowed' : 'disallowed'}. Initial processable count: ${processableUniqueAbsoluteUrls.length}`);
    if (!rootAllowed && uniqueUrlsToProcessInitially.includes(websiteUrl)) {
        await globalLoggerInstance.logUrlSkipped(websiteUrl, 'disallowed by robots.txt (root)');
    }
    return {
        results: [],
        urls: [],
        mainLanguage: 'unknown'
    };
  }
  
  const crawlResults: CrawlResult[] = [];
  const processedUrlTasks = new Set<string>();
  const processedContentSignatures = new Set<string>();

  const domain = new URL(websiteUrl).hostname;

  let mainLanguage = 'unknown';
  try {
    const rootResponse = await fetch(websiteUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (rootResponse.ok) {
      const rootHtml = await rootResponse.text();
      const { allExtractedText: rootCleanedText } = cleanAndExtractMainContent(rootHtml);
      if (rootCleanedText) {
        mainLanguage = detectLanguage(websiteUrl, rootCleanedText, {
            importantUrls: config.importantUrlsForDetection,
            urlLanguageHints: config.urlLanguageHintsForDetection
        });
      }
    }
  } catch (e) {
    console.warn(`[HTML Crawler] Could not fetch or process root URL ${websiteUrl} for main language detection:`, e);
  }
  console.log(`[HTML Crawler] Site's primary reference language (from root): ${mainLanguage}`);

  await processUrlsConcurrently({
    urlsToProcess: trulyProcessableUrls,
    websiteUrl,
    robotsRules,
    config,
    crawlResults,
    processedUrlTasks,
    processedContentSignatures,
    mainLanguage,
    domain
  });
  
  const attemptedUrls = Array.from(processedUrlTasks);

  return {
    results: crawlResults,
    urls: attemptedUrls,
    mainLanguage
  };
};

export const processHtmlContent = async (config: CrawlConfig, crawlOutput: CrawlOutput): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> => {
  const { results, mainLanguage: lang } = crawlOutput;

  const allLlmSegmentedChunks: LLMSegmentedChunk[] = [];
  const maxCharsPerGptChunk = 32000;

  for (const result of results) {
    if (result.status === 'processed' && result.cleanedText && result.fullUrl) {
      try {
        const cleanedText = result.cleanedText;
        console.log(`[HTML Crawler] Pre-splitting content for: ${result.fullUrl} (Original length: ${cleanedText.length} chars)`);

        const preChunks = preSplitByMarkdownAndSize(cleanedText, { maxCharsPerChunk: maxCharsPerGptChunk });
        console.log(`[HTML Crawler] URL ${result.fullUrl} was pre-split into ${preChunks.length} chunk(s) for LLM processing.`);

        const savedPreChunkPaths: string[] = [];
        let llmSegmentedChunksFromThisUrl: LLMSegmentedChunk[] = [];

        for (let preChunkIndex = 0; preChunkIndex < preChunks.length; preChunkIndex++) {
          const preChunkContent = preChunks[preChunkIndex];
          const savedPath = saveMarkdownPreChunk(result.fullUrl, preChunkIndex, preChunkContent);
          if (savedPath) {
            savedPreChunkPaths.push(path.basename(savedPath));
          }

          console.log(`[HTML Crawler] Segmenting and categorizing pre-chunk ${preChunkIndex + 1}/${preChunks.length} for: ${result.fullUrl} (Length: ${preChunkContent.length} chars)`);
          const segmentationResult = await segmentAndCategorizeByLLM(
            preChunkContent,
            result.fullUrl,
            result.pageTitle,
            config,
            preChunkIndex,
            preChunks.length
          );
          llmSegmentedChunksFromThisUrl.push(...segmentationResult.llmSegmentedChunks);
          console.log(`[HTML Crawler] Pre-chunk ${preChunkIndex + 1}/${preChunks.length} for URL ${result.fullUrl} yielded ${segmentationResult.llmSegmentedChunks.length} LLM-defined sub-chunks.`);
        }

        const preChunksManifest = {
          sourceUrl: result.fullUrl,
          originalCleanedTextPath: `../../01_cleaned_text/cleaned.txt`,
          maxCharsPerGptChunk,
          numberOfPreChunks: preChunks.length,
          preChunkFileNames: savedPreChunkPaths,
          timestamp: new Date().toISOString(),
        };
        saveMarkdownPreChunkManifest(result.fullUrl, preChunksManifest);
        
        allLlmSegmentedChunks.push(...llmSegmentedChunksFromThisUrl);

      } catch (error) {
        console.error(`[HTML Crawler] Failed to pre-split, segment, or categorize content for ${result.fullUrl}:`, error);
        await globalLoggerInstance.logUrlFailed(result.fullUrl, `Markdown pre-splitting or LLM segmentation/categorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  if (allLlmSegmentedChunks.length === 0) {
    console.warn('[HTML Crawler] No content was successfully segmented and categorized by LLM.');
    return {
        mergedText: '',
        pageCount: 0,
        uniqueParagraphs: 0,
        businessId: config.businessId!,
        source: config.websiteUrl!,
        embeddingsStatus: 'No LLM-segmented chunks to process'
    };
  }

  const validProcessedPageUrls = Array.from(new Set(allLlmSegmentedChunks.map(chunk => chunk.sourceUrl)));
  const urlsWithLlmChunks = new Set(allLlmSegmentedChunks.map(chunk => chunk.sourceUrl));
  const successfullyProcessedRootUrls = config.websiteUrl && results.find(r => r.fullUrl === config.websiteUrl && r.status === 'processed' && urlsWithLlmChunks.has(r.fullUrl)) 
                                      ? [config.websiteUrl] 
                                      : [];

  const embeddingsStatus = await processContentWithGrouping(
    config,
    allLlmSegmentedChunks,
    validProcessedPageUrls,
    successfullyProcessedRootUrls
  );

  await globalLoggerInstance.logSummary();

  const mergedText = allLlmSegmentedChunks.map(chunk => chunk.chunkText).join('\n\n\n');

  return {
    mergedText: mergedText,
    pageCount: validProcessedPageUrls.length,
    uniqueParagraphs: allLlmSegmentedChunks.length,
    businessId: config.businessId!,
    source: config.websiteUrl!,
    ...(embeddingsStatus ? { embeddingsStatus } : {}),
  };
};

export const crawlAndProcess = async (config: CrawlConfig): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> => {
  const outputDir = path.resolve(URL_FETCHER_CONFIG.CRAWL_OUTPUT_DIR);
  
  if (!globalLoggerInstance.isInitialized) { 
    if (fs.existsSync(outputDir)) {
      console.log(`[Crawl Setup] Deleting existing output directory: ${outputDir}`);
      try {
        fs.rmSync(outputDir, { recursive: true, force: true });
        console.log(`[Crawl Setup] Successfully deleted ${outputDir}`);
      } catch (error) {
        console.error(`[Crawl Setup] Failed to delete ${outputDir}:`, error);
      }
    }
    await globalLoggerInstance.initialize(outputDir); 
    console.log(`[Crawl Setup] Logger initialized. Output path: ${outputDir}`);
  } else {
    const currentStats = await globalLoggerInstance.getCurrentStats();
    console.log(`[Crawl Setup] Logger already initialized. Using existing output path: ${currentStats.processingStats.baseOutputPath}`);
  }

  const crawlOutput = await crawlWebsite(config);
  if (!crawlOutput || crawlOutput.results.filter(r => r.status === 'processed').length === 0) {
    console.warn('[HTML Crawler] No pages were successfully processed by crawlWebsite. Skipping content processing stage.');
    if(globalLoggerInstance.isInitialized) await globalLoggerInstance.logSummary();
    return {
        mergedText: '',
        pageCount: 0,
        uniqueParagraphs: 0,
        businessId: config.businessId!,
        source: config.websiteUrl || 'unknown',
        embeddingsStatus: 'No pages processed to segment'
    };
  }
  return processHtmlContent(config, crawlOutput);
};
