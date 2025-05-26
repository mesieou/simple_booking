import { CrawlConfig } from '../../config';
import { getAllDomainLinksRecursive } from './linkCrawler';

/**
 * Manages the crawling process to extract all relevant links from a website
 */
export async function crawlWebsiteForLinks(config: CrawlConfig, mainLanguage: string): Promise<string[]> {
  if (!config.websiteUrl) {
    throw new Error('websiteUrl is required for crawling');
  }
  
  console.log('[Crawler] Starting link extraction from:', config.websiteUrl);
  const startTime = Date.now();
  const urls = await getAllDomainLinksRecursive(
    config.websiteUrl,
    config.maxPages || 100,
    config.concurrency || 5,
    mainLanguage,
    config.maxDepth ?? 2,
    config.skipProductPages ?? true,
    config.skipBlogPages ?? true
  );
  console.log(`[Crawler] Link extraction completed in ${(Date.now() - startTime)/1000}s. Found ${urls.length} links.`);
  return urls;
} 