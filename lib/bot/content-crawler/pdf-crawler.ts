import { CrawlConfig, CrawlProcessingResult, CrawlResult, CrawlOutput } from './config';
import { textSplitterAndCategoriser } from './process-content/text-splitting-categorisation';
import { processContent as processContentWithGrouping } from './process-content/grouping-storing-content';
import { runConcurrentTasks } from './utils';
import { updateCrawlResults } from './url-fetcher/resultManager';
import { extractTextFromPdf } from './pdf-fetcher/extractor';
import { logger } from './process-content/logger';

export async function crawlPdfs(config: CrawlConfig, pdfBuffers: Buffer[]): Promise<CrawlOutput> {
  const allTexts: string[] = [];
  const crawlResults: CrawlResult[] = [];
  const processedUrls = new Set<string>();
  const concurrency = config.concurrency || 5;

  logger.initialize(pdfBuffers.length);

  async function* pdfProcessingTasks(buffers: Buffer[], concurrency: number) {
    for (let i = 0; i < buffers.length; i++) {
      yield async () => {
        const buffer = buffers[i];
        const url = `pdf-${i + 1}`; // Generate a unique identifier for each PDF

        if (processedUrls.has(url)) return;

        try {
          const result = await extractTextFromPdf(buffer);
          if (result.error) {
            logger.logUrlSkipped(url, 'extraction failed');
            updateCrawlResults(crawlResults, url, null, 'unknown', 'extraction failed');
            return;
          }

          allTexts.push(result.text);
          updateCrawlResults(crawlResults, url, result.text, result.metadata.language, 'ok');
          processedUrls.add(url);
          logger.logUrlProcessed(url, 1);

          if (config.requestDelay) {
            await new Promise(res => setTimeout(res, config.requestDelay));
          }
        } catch (error) {
          logger.logUrlSkipped(url, 'processing failed');
          updateCrawlResults(crawlResults, url, null, 'unknown', 'processing failed');
        }
      };
    }
  }

  await runConcurrentTasks(() => pdfProcessingTasks(pdfBuffers, concurrency), concurrency);

  return {
    texts: allTexts,
    results: crawlResults,
    urls: Array.from(processedUrls),
    mainLanguage: 'en' // Default to English for PDFs
  };
}

export async function processPdfContent(config: CrawlConfig, crawlOutput: CrawlOutput): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> {
  const { texts, urls } = crawlOutput;
  const embeddedUrls: string[] = [];

  const categorizedSections = await textSplitterAndCategoriser(
    texts, 
    config.businessId, 
    urls, 
    config.chunkSize || 2000, 
    config.chunkOverlap || 100
  );
  const embeddingsStatus = await processContentWithGrouping(config, categorizedSections, urls, embeddedUrls);

  return {
    mergedText: texts.join('\n\n'),
    pageCount: urls.length,
    uniqueParagraphs: texts.length,
    businessId: config.businessId,
    websiteUrl: config.websiteUrl,
    ...(embeddingsStatus ? { embeddingsStatus } : {})
  };
}

// Main function that orchestrates the PDF crawling and processing
export async function crawlAndProcessPdfs(config: CrawlConfig, pdfBuffers: Buffer[]): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> {
  const crawlOutput = await crawlPdfs(config, pdfBuffers);
  return processPdfContent(config, crawlOutput);
} 