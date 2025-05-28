import * as fs from 'fs';
import * as path from 'path';
import { CrawlConfig, CrawlProcessingResult, CrawlResult, CrawlOutput, defaultConfig, URL_FETCHER_CONFIG, USER_AGENT, CrawlResultStatus, ExtractedPatterns as CrawlExtractedPatterns, CategorizedContent, TextChunk } from '@/lib/config/config';
import { segmentAndCategorizeByLLM, LLMSegmentedChunk, LLMSegmenterResult } from './process-content/LLMSegmenterCategorizer';
import { processContent as processContentWithGrouping } from './process-content/grouping-storing-content';
import { runConcurrentTasks, detectLanguage } from './utils';
import { crawlWebsiteForLinks } from './url-fetcher/links-fetcher/crawlManager';
import { updateCrawlResults } from './url-fetcher/resultManager';
import { cleanAndExtractMainContent } from './url-fetcher/htmlCleaner';
import { logger as globalLoggerInstance } from '@/lib/bot/content-crawler/process-content/logger';
import { fetchAndParseRobotsTxt, isUrlAllowed, RobotsRules } from './url-fetcher/robotsParser';
import { processSingleUrlAndSaveArtifacts, ProcessedUrlResult } from './url-fetcher/SingleUrlProcessor';
import crypto from 'crypto';

export const crawlWebsite = async (config: CrawlConfig): Promise<CrawlOutput> => {
  const { websiteUrl: initialWebsiteUrl, concurrency: configConcurrency } = config;

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
  }
  
  const crawlResults: CrawlResult[] = [];
  const processedUrlTasks = new Set<string>();
  const processedContentSignatures = new Set<string>();

  const concurrency = configConcurrency ?? defaultConfig.concurrency;
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

  async function* urlProcessingTaskGenerator(urlsForTasks: string[]) {
    for (const currentUrlToProcess of urlsForTasks) {
      let fullUrl: string;
      try {
        fullUrl = new URL(currentUrlToProcess, websiteUrl).toString();
      } catch (e) {
        await globalLoggerInstance.logUrlSkipped(currentUrlToProcess, 'Invalid URL structure before processing');
        updateCrawlResults(crawlResults, domain, null, 'unknown', 'Invalid URL structure', currentUrlToProcess);
        continue;
      }

      if (processedUrlTasks.has(fullUrl)) {
        continue;
      }
      processedUrlTasks.add(fullUrl);

      if (!isUrlAllowed(fullUrl, robotsRules, websiteUrl)) {
        await globalLoggerInstance.logUrlSkipped(fullUrl, 'disallowed by robots.txt');
        updateCrawlResults(crawlResults, domain, null, 'unknown', 'disallowed by robots.txt', fullUrl);
        continue;
      }
      
      yield async () => {
        const result: ProcessedUrlResult = await processSingleUrlAndSaveArtifacts(fullUrl, config);

        if (result.status === 'success' && result.cleanedText && result.finalUrl) {
          const currentContentSignature = crypto.createHash('sha256').update(result.cleanedText).digest('hex');
          
          const pageTitleForSuccessUpdate: string | null = result.pageTitle !== undefined ? result.pageTitle : null;
          const cleanedTextForSuccessUpdate: string = result.cleanedText;
          const languageForSuccessUpdate: string = result.language || mainLanguage;
          const finalUrlForSuccessUpdate: string = result.finalUrl;
          const patternsForSuccessUpdate: CrawlExtractedPatterns | null = result.extractedPatterns ? result.extractedPatterns as CrawlExtractedPatterns : null;

          if (processedContentSignatures.has(currentContentSignature)) {
            const reason = `duplicate content (signature: ${currentContentSignature})`;
            await globalLoggerInstance.logUrlSkipped(finalUrlForSuccessUpdate, reason);
            updateCrawlResults(crawlResults, domain, cleanedTextForSuccessUpdate, languageForSuccessUpdate, reason, finalUrlForSuccessUpdate, patternsForSuccessUpdate, pageTitleForSuccessUpdate);
          } else {
            processedContentSignatures.add(currentContentSignature);
            await globalLoggerInstance.logUrlProcessed(finalUrlForSuccessUpdate);
            updateCrawlResults(crawlResults, domain, cleanedTextForSuccessUpdate, languageForSuccessUpdate, 'ok', finalUrlForSuccessUpdate, patternsForSuccessUpdate, pageTitleForSuccessUpdate);
          }
        } else {
          const reason = result.errorMessage || 'Unknown processing error';
          const pageTitleForFailureUpdate: string | null = result.pageTitle !== undefined ? result.pageTitle : null;
          const cleanedTextForFailureUpdate: string | null = result.cleanedText !== undefined ? result.cleanedText : null;
          const languageForFailureUpdate: string = result.language || mainLanguage;
          const finalUrlForFailureUpdate: string = result.finalUrl || fullUrl;
          const patternsForFailureUpdate: CrawlExtractedPatterns | null = result.extractedPatterns ? result.extractedPatterns as CrawlExtractedPatterns : null;

          updateCrawlResults(crawlResults, domain, cleanedTextForFailureUpdate, languageForFailureUpdate, reason, finalUrlForFailureUpdate, patternsForFailureUpdate, pageTitleForFailureUpdate);
        }

        if (config.requestDelay) {
          await new Promise(res => setTimeout(res, config.requestDelay!));
        }
      };
    }
  }

  await runConcurrentTasks(() => urlProcessingTaskGenerator(trulyProcessableUrls), concurrency);
  
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

  for (const result of results) {
    if (result.status === 'processed' && result.cleanedText && result.fullUrl) {
      try {
        console.log(`[HTML Crawler] Segmenting and categorizing content for: ${result.fullUrl}`);
        const segmentationResult = await segmentAndCategorizeByLLM(
          result.cleanedText,
          result.fullUrl,
          result.pageTitle,
          config
        );
        allLlmSegmentedChunks.push(...segmentationResult.llmSegmentedChunks);
        console.log(`[HTML Crawler] URL ${result.fullUrl} yielded ${segmentationResult.llmSegmentedChunks.length} LLM-defined chunks.`);
      } catch (error) {
        console.error(`[HTML Crawler] Failed to segment/categorize content for ${result.fullUrl}:`, error);
        await globalLoggerInstance.logUrlFailed(result.fullUrl, `LLM segmentation/categorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const categorizedSectionsForGrouping: CategorizedContent[] = allLlmSegmentedChunks.map(chunk => ({
    content: chunk.chunkText,
    category: chunk.category,
    confidence: chunk.confidence || 0.75,
    confidenceReason: 'Categorized by LLM segmenter',
    url: chunk.sourceUrl,
    pageTitle: chunk.pageTitle
  }));

  const textChunksForManifest: TextChunk[] = allLlmSegmentedChunks.map((chunk, index) => ({
    text: chunk.chunkText,
    sourcePageUrl: chunk.sourceUrl,
    sourceBlockIndex: 0,
    chunkInBlockIndex: chunk.chunkOrder,
    totalChunksInBlock: allLlmSegmentedChunks.filter(c => c.sourceUrl === chunk.sourceUrl).length,
    sourcePageTitle: chunk.pageTitle,
    pageLang: lang,
    metadata: {
        wordCount: chunk.chunkText.split(/\s+/).length,
        charCount: chunk.chunkText.length
    }
  }));

  const validProcessedPageUrls = Array.from(new Set(allLlmSegmentedChunks.map(chunk => chunk.sourceUrl)));
  const successfullyProcessedRootUrls = config.websiteUrl && results.find(r => r.fullUrl === config.websiteUrl && r.status === 'processed') ? [config.websiteUrl] : [];

  const embeddingsStatus = await processContentWithGrouping(
    config,
    categorizedSectionsForGrouping,
    validProcessedPageUrls,
    successfullyProcessedRootUrls,
    textChunksForManifest
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
  // Check if any results were processed to avoid errors if crawlOutput.results is empty or all failed
  if (!crawlOutput || crawlOutput.results.filter(r => r.status === 'processed').length === 0) {
    console.warn('[HTML Crawler] No pages were successfully processed by crawlWebsite. Skipping content processing stage.');
    // Ensure summary is still saved even if no content processing happens
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
