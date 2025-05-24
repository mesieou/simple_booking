import { CrawlConfig, CrawlProcessingResult, CrawlResult, CrawlOutput } from './config';
import { textSplitterAndCategoriser } from './process-content/text-splitting-categorisation';
import { processContent as processContentWithGrouping } from './process-content/grouping-storing-content';
import { runConcurrentTasks } from './utils';
import { crawlWebsiteForLinks } from './url-fetcher/links-fetcher/crawlManager';
import { updateCrawlResults } from './url-fetcher/resultManager';
import { fetchCleanAndDetectLanguageFromPage } from './url-fetcher/fetchCleanAndDetectLanguage';
import { logger } from './process-content/logger';

export async function crawlWebsite(config: CrawlConfig): Promise<CrawlOutput> {
  const { html: rootHtml, language: mainLanguage } = await fetchCleanAndDetectLanguageFromPage(config.websiteUrl);
  if (!rootHtml) throw new Error('Failed to fetch root page for language detection');

  const urls = await crawlWebsiteForLinks(config, mainLanguage);
  const searchedUrls: string[] = [];
  const allTexts: string[] = [];
  const crawlResults: CrawlResult[] = [];
  const processedUrls = new Set<string>();
  const concurrency = config.concurrency || 5;

  async function* urlProcessingTasks(urls: string[], concurrency: number) {
    for (let i = 0; i < urls.length; i++) {
      yield async () => {
        const url = urls[i];
        searchedUrls.push(url);
        if (processedUrls.has(url)) return;
        processedUrls.add(url);

        const { html, language: pageLang } = await fetchCleanAndDetectLanguageFromPage(url);
        if (!html) {
          logger.logUrl(url, 'skipped', 'fetch failed');
          updateCrawlResults(crawlResults, url, null, 'unknown', 'fetch failed');
          return;
        }

        if (pageLang !== mainLanguage) {
          logger.logUrl(url, 'filtered', 'language mismatch');
          updateCrawlResults(crawlResults, url, null, pageLang, 'language mismatch');
          return;
        }

        allTexts.push(html);
        updateCrawlResults(crawlResults, url, html, pageLang, 'ok');
        logger.logUrl(url, 'processed');

        if (config.requestDelay) {
          await new Promise(res => setTimeout(res, config.requestDelay));
        }
      };
    }
  }

  await runConcurrentTasks(() => urlProcessingTasks(urls, concurrency), concurrency);

  logger.setAllFoundUrls(searchedUrls);

  return {
    texts: allTexts,
    results: crawlResults,
    urls: searchedUrls,
    mainLanguage
  };
}

export async function processHtmlContent(config: CrawlConfig, crawlOutput: CrawlOutput): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> {
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

  logger.printDetailedTables();

  return {
    mergedText: texts.join('\n\n'),
    pageCount: urls.length,
    uniqueParagraphs: texts.length,
    businessId: config.businessId,
    websiteUrl: config.websiteUrl,
    ...(embeddingsStatus ? { embeddingsStatus } : {})
  };
}

// Main function that orchestrates the crawling and processing
export async function crawlAndProcess(config: CrawlConfig): Promise<CrawlProcessingResult & { embeddingsStatus?: string }> {
  const crawlOutput = await crawlWebsite(config);
  return processHtmlContent(config, crawlOutput);
} 