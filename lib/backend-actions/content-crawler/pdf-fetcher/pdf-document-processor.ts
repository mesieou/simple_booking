import {
  CrawlConfig,
  CrawlResult,
  defaultConfig,
  // ExtractedPatterns as CrawlExtractedPatterns, // Not used for PDF results in current logic
  // CrawlResultStatus, // Not directly used here for status setting
} from '@/lib/general-config/general-config';
import { runConcurrentTasks } from '../content-crawler-utils';
import { updateCrawlResults } from '../url-fetcher/resultManager'; // Re-using for consistency, though PDF structure is simpler
import { processSinglePdfAndSaveArtifacts, ProcessedPdfResult } from './SinglePdfProcessor';
// import { logger as globalLoggerInstance } from '../process-content/logger'; // Logging of discovered URLs will be handled by caller

export interface ProcessPdfsResult {
  crawlResults: CrawlResult[];
  successfullyProcessedBasePdfs: string[];
  allDiscoveredPageUrls: string[]; // For logging purposes by the caller
}

export async function processPdfBuffersConcurrently(
  config: CrawlConfig,
  pdfBuffers: Buffer[],
): Promise<ProcessPdfsResult> {
  const crawlResults: CrawlResult[] = [];
  const successfullyProcessedBasePdfs: string[] = [];
  const allDiscoveredPageUrls: string[] = [];

  const concurrency = config.concurrency ?? defaultConfig.concurrency;

  async function* pdfProcessingTasksGenerator(buffers: Buffer[]) {
    for (let i = 0; i < buffers.length; i++) {
      yield async () => {
        const buffer = buffers[i];
        const pdfName = config.pdfNames?.[i] || `document-${i + 1}.pdf`;
        const basePdfSourceUrl = `pdf:${pdfName}`;

        const result: ProcessedPdfResult = await processSinglePdfAndSaveArtifacts(
          buffer,
          pdfName,
          config
        );

        if (result.status === 'success') {
          successfullyProcessedBasePdfs.push(basePdfSourceUrl);
          for (const page of result.processedPages) {
            const pageSpecificUrl = `${result.basePdfSourceUrl}#page=${page.pageNum}`;
            allDiscoveredPageUrls.push(pageSpecificUrl);

            if (page.status === 'processed') {
              updateCrawlResults(
                crawlResults,
                basePdfSourceUrl, // documentUrl (base PDF identifier)
                page.text, // cleanedText for the page
                page.language, // pageLang
                'ok', // reason (maps to 'processed' status)
                pageSpecificUrl, // fullUrl (specific page URL)
                null, // extractedPatterns
                `${pdfName} - Page ${page.pageNum}` // pageTitle
              );
            } else {
              // Individual page failures within a successfully processed PDF are not added to crawlResults here.
              // They are logged by SinglePdfProcessor if significant.
            }
          }
        } else {
          // PDF processing failed at a higher level
          allDiscoveredPageUrls.push(basePdfSourceUrl); // Log the attempt for the base PDF URL
          updateCrawlResults(
            crawlResults,
            basePdfSourceUrl, // documentUrl
            null, // cleanedText
            'unknown', // pageLang
            result.errorMessage || 'PDF processing failed', // reason
            basePdfSourceUrl // fullUrl
          );
        }

        if (config.requestDelay && config.requestDelay > 0) {
          await new Promise((res) => setTimeout(res, config.requestDelay!));
        }
      };
    }
  }

  await runConcurrentTasks(() => pdfProcessingTasksGenerator(pdfBuffers), concurrency);

  return {
    crawlResults,
    successfullyProcessedBasePdfs,
    allDiscoveredPageUrls,
  };
} 