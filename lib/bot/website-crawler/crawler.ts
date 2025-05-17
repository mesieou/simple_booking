import { SimpleCrawlConfig, SimpleCrawlResult } from './types';
import { extractAndCleanContent, deduplicateParagraphs, sendMergedTextToGpt4Turbo } from './content-processor';
import { getAllDomainLinksRecursive } from './url-fetcher';
import { createEmbeddingsFromCategorizedSections } from './embeddings';

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export interface ExtendedCrawlConfig extends SimpleCrawlConfig {
  categorizedSections?: any[];
  chunkSize?: number;
  concurrencyLimit?: number;
}

export async function crawlAndMergeText(config: SimpleCrawlConfig): Promise<SimpleCrawlResult & { embeddingsStatus?: string }> {
  const urls = await getAllDomainLinksRecursive(
    config.websiteUrl,
    config.maxPages || 100,
    config.concurrency || 5 // pass concurrency to the crawler
  );
  const allTexts: string[] = [];
  const concurrency = config.concurrency || 5;
  let idx = 0;

  // Concurrency-limited worker pool for fetching and extracting text
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= urls.length) break;
      const url = urls[i];
      const html = await fetchHtml(url);
      if (!html) continue;
      const text = extractAndCleanContent(html);
      if (text && text.length > 40) {
        allTexts.push(text);
      }
      if (config.requestDelay) {
        await new Promise(res => setTimeout(res, config.requestDelay));
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const { merged, uniqueCount } = deduplicateParagraphs(allTexts);
  let embeddingsStatus;
  try {
    // Auto-categorize using GPT-4-turbo
    const gptCategorized = await sendMergedTextToGpt4Turbo(merged, config.businessId, config.websiteUrl);
    let categorizedSections: any[] = [];
    try {
      categorizedSections = JSON.parse(gptCategorized);
    } catch (e) {
      throw new Error('Failed to parse GPT-4-turbo categorization output: ' + gptCategorized);
    }
    await createEmbeddingsFromCategorizedSections(
      config.businessId,
      config.websiteUrl,
      categorizedSections // use defaults for chunkSize and concurrencyLimit
    );
    embeddingsStatus = 'success';
  } catch (e) {
    embeddingsStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }
  return {
    mergedText: merged,
    pageCount: urls.length,
    uniqueParagraphs: uniqueCount,
    businessId: config.businessId,
    websiteUrl: config.websiteUrl,
    ...(embeddingsStatus ? { embeddingsStatus } : {})
  };
} 