import { CrawlConfig, CrawlProcessingResult, CrawlResult, CrawlOutput, defaultConfig, URL_FETCHER_CONFIG } from '@/lib/config/config';
import { processContent as processContentWithGrouping } from './process-content/grouping-storing-content';
import { logger as globalLoggerInstance } from '@/lib/bot/content-crawler/process-content/logger';
import path from 'path';
import { LLMSegmentedChunk } from './process-content/LLMSegmenterCategorizer';
import { initializeCrawlerEnvironment } from './crawler-setup';
import { processPdfBuffersConcurrently, ProcessPdfsResult } from './pdf-fetcher/pdf-document-processor';
import { generateLlmSegmentedChunksForPdfPages } from './process-content/page-content-processor';

export async function crawlPdfs(config: CrawlConfig, pdfBuffers: Buffer[]): Promise<CrawlOutput & { successfullyProcessedBasePdfs: string[] }> {
  const { 
    crawlResults,
    successfullyProcessedBasePdfs,
    allDiscoveredPageUrls 
  }: ProcessPdfsResult = await processPdfBuffersConcurrently(config, pdfBuffers);

  // Log all page-specific URLs that were encountered
  await globalLoggerInstance.recordDiscoveredUrls(allDiscoveredPageUrls);

  const processedPageUrlsForOutput = crawlResults
    .filter(r => r.status === 'processed' && r.fullUrl.startsWith('pdf:'))
    .map(r => r.fullUrl);

  return {
    results: crawlResults, 
    urls: processedPageUrlsForOutput, 
    mainLanguage: 'unknown', // PDF language is per-page
    successfullyProcessedBasePdfs
  };
}

export async function processPdfContent(
    config: CrawlConfig, 
    crawlOutput: CrawlOutput & { successfullyProcessedBasePdfs: string[] }
): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> {
  const { results, successfullyProcessedBasePdfs } = crawlOutput;

  const processablePdfPages = results.filter(r => 
    r.status === 'processed' && 
    r.cleanedText && 
    r.cleanedText.length > 0 && 
    r.fullUrl.startsWith('pdf:')
  );

  if (processablePdfPages.length === 0) {
    console.log('[PDF Crawler] No processed PDF pages to segment and categorize.');
    if(globalLoggerInstance.isInitialized) await globalLoggerInstance.logSummary();
    return {
        mergedText: '',
        pageCount: 0,
        uniqueParagraphs: 0,
        businessId: config.businessId,
        source: config.pdfNames?.[0] || (successfullyProcessedBasePdfs.length > 0 ? successfullyProcessedBasePdfs[0] : 'unknown.pdf'),
        embeddingsStatus: 'No PDF content to process'
    };
  }

  const allPdfLlmSegmentedChunks = await generateLlmSegmentedChunksForPdfPages({
    pdfPagesToProcess: processablePdfPages,
    config
  });

  if (allPdfLlmSegmentedChunks.length === 0) {
    console.warn('[PDF Crawler] No PDF content was successfully segmented by LLM.');
    if(globalLoggerInstance.isInitialized) await globalLoggerInstance.logSummary();
    return {
        mergedText: '',
        pageCount: processablePdfPages.length, 
        uniqueParagraphs: 0,
        businessId: config.businessId,
        source: config.pdfNames?.[0] || (successfullyProcessedBasePdfs.length > 0 ? successfullyProcessedBasePdfs[0] : 'unknown.pdf'),
        embeddingsStatus: 'No LLM-segmented chunks from PDF to process'
    };
  }

  const processedPageUrlsForGrouping = Array.from(new Set(allPdfLlmSegmentedChunks.map(chunk => chunk.sourceUrl)));

  const embeddingsStatus = await processContentWithGrouping(
    config, 
    allPdfLlmSegmentedChunks, 
    processedPageUrlsForGrouping, 
    successfullyProcessedBasePdfs 
  );
  
  await globalLoggerInstance.logSummary();

  const allPdfTextFromLlmChunks = allPdfLlmSegmentedChunks.map(item => item.chunkText).join('\n\n');

  return {
    mergedText: allPdfTextFromLlmChunks,
    pageCount: processablePdfPages.length, 
    uniqueParagraphs: allPdfLlmSegmentedChunks.length, 
    businessId: config.businessId,
    source: config.pdfNames?.[0] || (successfullyProcessedBasePdfs.length > 0 ? successfullyProcessedBasePdfs[0] : 'unknown.pdf'), 
    ...(embeddingsStatus ? { embeddingsStatus } : {}),
  };
}

export async function crawlAndProcessPdfs(config: CrawlConfig, pdfBuffers: Buffer[]): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> {
  await initializeCrawlerEnvironment(); 

  const crawlOutput = await crawlPdfs(config, pdfBuffers);
  if (crawlOutput.results.filter(r => r.status === 'processed').length === 0) {
    console.warn('[PDF Crawler] No PDF pages were successfully processed. Skipping content processing stage.');
    if(globalLoggerInstance.isInitialized) await globalLoggerInstance.logSummary();
    return {
        mergedText: '',
        pageCount: 0,
        uniqueParagraphs: 0,
        businessId: config.businessId,
        source: config.pdfNames?.[0] || 'processed_pdfs',
        embeddingsStatus: 'No content to process'
    };
  }
  return processPdfContent(config, crawlOutput);
}
