import { SimpleCrawlConfig, SimpleCrawlResult, CategorizedContent } from './types';
import { extractAndCleanContent } from './content-processor';
import { getAllDomainLinksRecursive } from './url-fetcher';
import { createEmbeddingsFromCategorizedSections } from './embeddings';
import fs from 'fs';
import { detectLanguage, isLowValueContent, cleanContent } from './utils';
import { categorizeWebsiteContent } from '@/lib/helpers/openai/functions/content-analysis';
import { pushToQueue } from '@/lib/helpers/openai/rate-limiter';
import { textSplitterAndCategoriser } from './text-splitter-categoriser';

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
  categorizedSections?: CategorizedContent[];
  chunkSize?: number;
  concurrencyLimit?: number;
}

// Utility: Split text into chunks by word count with overlap
function splitTextIntoChunks(text: string, maxWords: number, overlapWords: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(words.length, start + maxWords);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) break;
    start = end - overlapWords;
    if (start < 0) start = 0;
  }
  return chunks;
}

// Helper to wrap categorizeWebsiteContent in the OpenAI queue
function categorizeInQueue(text: string, businessId: string, url: string) {
  return new Promise<CategorizedContent[]>((resolve, reject) => {
    pushToQueue(async () => {
      try {
        const result = await categorizeWebsiteContent(text, businessId, url);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  });
}

// NOTE: Language detection and content filtering now use robust logic and detailed logging (see utils.ts)
export async function crawlAndMergeText(config: SimpleCrawlConfig): Promise<SimpleCrawlResult & { embeddingsStatus?: string }> {
  if (!fs.existsSync('crawl-output')) fs.mkdirSync('crawl-output');

  const rootHtml = await fetchHtml(config.websiteUrl);
  if (!rootHtml) throw new Error('Failed to fetch root page for language detection');
  const mainLanguage = detectLanguage(config.websiteUrl, rootHtml);

  // 1. Log when links are being extracted
  console.log('[Crawler] Extracting links from:', config.websiteUrl);
  const urls = await getAllDomainLinksRecursive(
    config.websiteUrl,
    config.maxPages || 100,
    config.concurrency || 1,
    mainLanguage,
    config.maxDepth ?? 2,
    config.skipProductPages ?? true,
    config.skipBlogPages ?? true
  );
  console.log(`[Crawler] Extracted ${urls.length} links.`);
  const allTexts: string[] = [];
  const embeddedUrls: string[] = [];
  const concurrency = 1;
  let idx = 0;

  // Collect crawl results for summary
  const crawlResults: {
    url: string;
    status: 'crawled' | 'skipped';
    reason: string;
    detectedLanguage: string;
    embedded: boolean;
    value: number; // cleaned text length
  }[] = [];

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= urls.length) break;
      const url = urls[i];
      // Log fetching progress for user
      const percent = Math.round(((i + 1) / urls.length) * 100);
      console.log(`Fetching link: ${url} (${percent}%)`);
      const html = await fetchHtml(url);
      if (!html) {
        crawlResults.push({ url, status: 'skipped', reason: 'fetch failed', detectedLanguage: 'unknown', embedded: false, value: 0 });
        continue;
      }
      const pageLang = detectLanguage(url, html);
      if (pageLang !== mainLanguage) {
        crawlResults.push({ url, status: 'skipped', reason: 'language mismatch', detectedLanguage: pageLang, embedded: false, value: 0 });
        continue;
      }
      const text = extractAndCleanContent(html);
      const cleanedText = cleanContent(text);
      const value = cleanedText.length;
      const lowValueReason = isLowValueContent(cleanedText);
      if (lowValueReason) {
        crawlResults.push({ url, status: 'skipped', reason: lowValueReason, detectedLanguage: pageLang, embedded: false, value });
        continue;
      }
      fs.writeFileSync(`crawl-output/page-${i+1}-cleaned.txt`, cleanedText, 'utf8');
      if (cleanedText && cleanedText.length > 40) {
        allTexts.push(cleanedText);
        embeddedUrls.push(url);
        crawlResults.push({ url, status: 'crawled', reason: 'ok', detectedLanguage: pageLang, embedded: true, value });
      } else {
        crawlResults.push({ url, status: 'skipped', reason: 'too short', detectedLanguage: pageLang, embedded: false, value });
      }
      if (config.requestDelay) {
        await new Promise(res => setTimeout(res, config.requestDelay));
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  // Print summary table
  console.log('\nCrawl Summary:');
  console.log('-----------------------------------------------------------------------------------------------');
  console.log('Status | Embedded | Language | Value | Reason         | URL');
  console.log('-----------------------------------------------------------------------------------------------');
  for (const r of crawlResults) {
    console.log(`${r.status.padEnd(7)} | ${r.embedded ? 'Yes ' : ' No '}     | ${r.detectedLanguage.padEnd(8)} | ${r.value.toString().padEnd(5)} | ${r.reason.padEnd(14)} | ${r.url}`);
  }
  console.log('-----------------------------------------------------------------------------------------------');
  const embeddedCount = crawlResults.filter(r => r.embedded).length;
  const skippedCount = crawlResults.length - embeddedCount;
  console.log(`Total: ${crawlResults.length} | Embedded: ${embeddedCount} | Skipped: ${skippedCount}`);
  console.log('-----------------------------------------------------------------------------------------------\n');

  const inputWords = allTexts.reduce((acc, t) => acc + t.split(/\s+/).length, 0);
  const inputTokens = Math.round(inputWords * 1.33);

  // Use the new modularized categorization function
  const categorizedSections = await textSplitterAndCategoriser(
    allTexts,
    config.businessId,
    urls,
    2000, // chunkSize
    100,  // chunkOverlap
    5     // gptConcurrency
  );

  const DEFAULT_CHUNK_SIZE = 1000;
  const DEFAULT_CONCURRENCY_LIMIT = 3;
  let embeddingsStatus;
  try {
    console.log('[Crawler] Creating embeddings and documents...');
    await createEmbeddingsFromCategorizedSections(
      config.businessId,
      config.websiteUrl,
      categorizedSections,
      DEFAULT_CHUNK_SIZE,
      DEFAULT_CONCURRENCY_LIMIT,
      urls.length, // pass totalPages
      embeddedUrls // pass embeddedUrls
    );
    console.log('[Crawler] Embeddings and documents creation complete.');
    embeddingsStatus = 'success';
  } catch (e) {
    embeddingsStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }
  return {
    mergedText: allTexts.join('\n\n'),
    pageCount: urls.length,
    uniqueParagraphs: allTexts.length,
    businessId: config.businessId,
    websiteUrl: config.websiteUrl,
    ...(embeddingsStatus ? { embeddingsStatus } : {})
  };
} 