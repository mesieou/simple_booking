import { CrawlConfig, CrawlProcessingResult, CrawlResult, CrawlOutput, defaultConfig, ExtractedPatterns as CrawlExtractedPatterns, CrawlResultStatus } from '@/lib/config/config';
import { textSplitterAndCategoriser } from './process-content/text-splitting-categorisation';
import { processContent as processContentWithGrouping } from './process-content/grouping-storing-content';
import { runConcurrentTasks } from './utils';
import { updateCrawlResults } from './url-fetcher/resultManager';
import { logger as globalLoggerInstance } from '@/lib/bot/content-crawler/process-content/logger';
import { saveUrlChunks } from './process-content/logger-artifact-savers';
import { processSinglePdfAndSaveArtifacts, ProcessedPdfResult } from './pdf-fetcher/SinglePdfProcessor';
import path from 'path';
import fs from 'fs';
import { URL_FETCHER_CONFIG } from '@/lib/config/config';

export async function crawlPdfs(config: CrawlConfig, pdfBuffers: Buffer[]): Promise<CrawlOutput & { successfullyProcessedBasePdfs: string[] }> {
  const crawlResults: CrawlResult[] = [];
  const successfullyProcessedBasePdfs: string[] = [];
  const allDiscoveredPageUrls: string[] = []; // For logger.recordDiscoveredUrls

  const concurrency = config.concurrency ?? defaultConfig.concurrency;

  async function* pdfProcessingTasks(buffers: Buffer[]) {
    for (let i = 0; i < buffers.length; i++) {
      yield async () => {
        const buffer = buffers[i];
        const pdfName = config.pdfNames?.[i] || `document-${i + 1}.pdf`;
        const basePdfSourceUrl = `pdf:${pdfName}`; // Used as the main URL for this PDF document

        const result: ProcessedPdfResult = await processSinglePdfAndSaveArtifacts(buffer, pdfName, config);

        if (result.status === 'success') {
          successfullyProcessedBasePdfs.push(basePdfSourceUrl); // Store the base URL identifier
          for (const page of result.processedPages) {
            const pageSpecificUrl = `${result.basePdfSourceUrl}#page=${page.pageNum}`;
            allDiscoveredPageUrls.push(pageSpecificUrl);

            if (page.status === 'processed') {
              updateCrawlResults(
                crawlResults,
                basePdfSourceUrl, // documentUrl (can be the base PDF identifier)
                page.text,       // cleanedText for the page
                page.language,   // pageLang
                'ok',            // reason (maps to 'processed' status)
                pageSpecificUrl, // fullUrl (the specific page URL)
                null,            // extractedPatterns (PDFs don't have them here)
                `${pdfName} - Page ${page.pageNum}` // pageTitle
              );
            } else {
              // Log individual skipped pages if necessary, or rely on overall PDF status
              // For now, we only add successfully 'processed' pages to crawlResults.
              // The SinglePdfProcessor has already logged the base PDF if all pages were bad.
              // We could add a CrawlResult with a 'skipped_other' status for these pages if desired.
              // console.log(`Page ${page.pageNum} of ${pdfName} was ${page.status}`);
            }
          }
        } else {
          // PDF processing failed at a higher level (extraction, or all pages bad)
          // SinglePdfProcessor already logged this skip/failure for basePdfSourceUrl.
          // Add a single CrawlResult for the failed PDF.
          updateCrawlResults(
            crawlResults,
            basePdfSourceUrl, // documentUrl
            null,            // cleanedText
            'unknown',       // pageLang
            result.errorMessage || 'PDF processing failed', // reason
            basePdfSourceUrl // fullUrl
          );
        }
        if (config.requestDelay) {
          await new Promise(res => setTimeout(res, config.requestDelay!));
        }
      };
    }
  }

  await runConcurrentTasks(() => pdfProcessingTasks(pdfBuffers), concurrency);
  
  // Log all page-specific URLs that were encountered (even if not all were added to crawlResults as 'processed')
  await globalLoggerInstance.recordDiscoveredUrls(allDiscoveredPageUrls);

  // urls in CrawlOutput should be the list of page-specific URLs that were successfully processed and added to crawlResults.
  const processedPageUrlsForOutput = crawlResults
    .filter(r => r.status === 'processed' && r.fullUrl.startsWith('pdf:'))
    .map(r => r.fullUrl);

  return {
    results: crawlResults, 
    urls: processedPageUrlsForOutput, 
    mainLanguage: 'unknown', // PDF language is per-page; overall language could be determined if needed.
    successfullyProcessedBasePdfs
  };
}

export async function processPdfContent(
    config: CrawlConfig, 
    crawlOutput: CrawlOutput & { successfullyProcessedBasePdfs: string[] }
): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> {
  const { results, successfullyProcessedBasePdfs } = crawlOutput;

  const itemsForCategorization: Array<{text: string, url: string, lang: string, pageTitle?: string, sourcePageInfo: any}> = results
    .filter(r => r.status === 'processed' && r.cleanedText && r.cleanedText.length > 0 && r.fullUrl.startsWith('pdf:'))
    .map(r => ({
      text: r.cleanedText!,
      url: r.fullUrl, // This is the pageSpecificUrl (e.g., pdf:doc.pdf#page=1)
      lang: r.detectedLanguage || 'unknown',
      pageTitle: r.pageTitle,
      sourcePageInfo: {
          originalUrl: r.fullUrl, 
          // blockIndex might not be relevant if each PDF page is one block for categorization
      }
    }));

  if (itemsForCategorization.length === 0) {
    console.log('[PDF Crawler] No processed PDF pages to categorize.');
    return {
        mergedText: '',
        pageCount: 0,
        uniqueParagraphs: 0,
        businessId: config.businessId,
        source: config.pdfNames?.[0] || 'unknown.pdf',
    };
  }

  // Ensure textSplitterAndCategoriser and processContentWithGrouping can handle pageSpecificUrls
  // and call saveUrlChunks / saveLlmInteraction using these pageSpecificUrls as identifiers.
  const { categorizedSections, allGeneratedChunks } = await textSplitterAndCategoriser(
    itemsForCategorization.map(item => item.text),
    itemsForCategorization.map(item => item.url), // Pass pageSpecificUrls
    config,
    config.chunkSize ?? defaultConfig.chunkSize,
    config.chunkOverlap ?? defaultConfig.chunkOverlap
  );

  // Example for saving chunks (conceptual, needs integration with textSplitterAndCategoriser output)
  // Assuming allGeneratedChunks is an array of chunk objects, each with a sourceUrl property.
  /*
  const chunksByUrl = allGeneratedChunks.reduce((acc, chunk) => {
      const url = chunk.sourcePageUrl; // Assuming chunk object has this property
      if (!acc[url]) acc[url] = [];
      acc[url].push(chunk);
      return acc;
  }, {} as Record<string, any[]>);
  for (const [pageUrl, chunks] of Object.entries(chunksByUrl)) {
      await saveUrlChunks(pageUrl, chunks.map(c => ({ id: c.id || crypto.randomUUID(), text: c.text })));
  }
  */

  const pageUrlsForEmbedding = itemsForCategorization.map(item => item.url);

  const embeddingsStatus = await processContentWithGrouping(
    config, 
    categorizedSections, 
    pageUrlsForEmbedding, // URLs of the actual items being processed (PDF pages)
    successfullyProcessedBasePdfs, // Base PDF identifiers
    allGeneratedChunks
  );
  
  await globalLoggerInstance.logSummary(); // Call the correct summary function

  const allPdfPageTexts = itemsForCategorization.map(item => item.text);

  return {
    mergedText: allPdfPageTexts.join('\n\n'),
    pageCount: itemsForCategorization.length,
    uniqueParagraphs: allGeneratedChunks.length, // Or a more accurate count of unique chunks
    businessId: config.businessId,
    source: config.pdfNames?.[0] || (successfullyProcessedBasePdfs.length > 0 ? successfullyProcessedBasePdfs[0] : 'unknown.pdf'), 
    ...(embeddingsStatus ? { embeddingsStatus } : {}),
  };
}

export async function crawlAndProcessPdfs(config: CrawlConfig, pdfBuffers: Buffer[]): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> {
  const outputDir = path.resolve(URL_FETCHER_CONFIG.CRAWL_OUTPUT_DIR); // Assuming PDFs also use the same root output

  // Initialize logger and artifact savers if not already done.
  if (!globalLoggerInstance.isInitialized) {
    // Clean directory *before* logger initialization if logger writes to it immediately.
    // This cleaning logic should ideally be centralized if both HTML and PDF crawls can run in the same overall process
    // and are expected to clear the *same* root outputDir.
    // For now, replicating the logic here.
    if (fs.existsSync(outputDir)) {
      console.log(`[Crawl Setup - PDF] Deleting existing output directory: ${outputDir}`);
      try {
        fs.rmSync(outputDir, { recursive: true, force: true });
        console.log(`[Crawl Setup - PDF] Successfully deleted ${outputDir}`);
      } catch (error) {
        console.error(`[Crawl Setup - PDF] Failed to delete ${outputDir}:`, error);
      }
    }
    await globalLoggerInstance.initialize(outputDir);
    console.log(`[Crawl Setup - PDF] Logger initialized. Output path: ${outputDir}`);
  } else {
    const currentStats = await globalLoggerInstance.getCurrentStats();
    console.log(`[Crawl Setup - PDF] Logger already initialized. Using existing output path: ${currentStats.processingStats.baseOutputPath}`);
  }

  const crawlOutput = await crawlPdfs(config, pdfBuffers);
  if (crawlOutput.results.filter(r => r.status === 'processed').length === 0) {
    console.warn('[PDF Crawler] No PDF pages were successfully processed. Skipping content processing stage.');
    // Return a minimal result or throw an error as appropriate
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
