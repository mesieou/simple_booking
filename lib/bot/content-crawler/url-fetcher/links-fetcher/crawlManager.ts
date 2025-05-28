import { CrawlConfig } from '@/lib/config/config';
import { getAllDomainLinksRecursive } from './linkCrawler';
import { fetchUrlsFromSitemap } from './sitemapParser';
import { RobotsRules, isUrlAllowed } from '../robotsParser';

/**
 * Manages the crawling process to extract all relevant links from a website
 */
export async function crawlWebsiteForLinks(
  config: CrawlConfig,
  robotsRules: RobotsRules | null
): Promise<{ allFoundAbsoluteUrls: string[], processableUniqueAbsoluteUrls: string[] }> {
  if (!config.websiteUrl) {
    throw new Error('websiteUrl is required for crawling');
  }
  
  const baseHref = new URL(config.websiteUrl).href; // For normalizing sitemap URLs if needed
  console.log('[Crawler] Starting link extraction from:', config.websiteUrl);
  const startTime = Date.now();

  let sitemapUrls: string[] = [];
  if (config.useSitemap !== false) { // Default to trying sitemap unless explicitly disabled
    try {
      // Assuming fetchUrlsFromSitemap returns normalized, absolute URLs that respect robots.txt if possible
      // Or it returns all, and we filter here. For now, assume it returns usable URLs.
      sitemapUrls = await fetchUrlsFromSitemap(config.websiteUrl, robotsRules);
      if (sitemapUrls.length > 0) {
        console.log(`[Sitemap] Found ${sitemapUrls.length} URLs in sitemap.`);
      }
    } catch (error) {
      console.warn(`[Sitemap] Error fetching or parsing sitemap for ${config.websiteUrl}:`, error);
    }
  }

  // Initialize sets with sitemap URLs
  // Normalize sitemap URLs to be sure, though they should be absolute
  const normalizedSitemapUrls = sitemapUrls.map(url => new URL(url, baseHref).href);

  const allFoundAbsoluteUrlsSet = new Set<string>(normalizedSitemapUrls);
  // Filter sitemap URLs by robots.txt if not already done by fetchUrlsFromSitemap
  // For now, assuming sitemap URLs from a trusted source are generally meant to be crawled,
  // but final check in html-crawler is key.
  const processableSitemapUrls = normalizedSitemapUrls.filter(url => isUrlAllowed(url, robotsRules, baseHref)); 
  const processableUniqueAbsoluteUrlsSet = new Set<string>(processableSitemapUrls);

  const crawlResult = await getAllDomainLinksRecursive(
    config.websiteUrl,
    config.maxPages || 100,
    config.concurrency || 5,
    config.maxDepth ?? 4,
    robotsRules // Pass robotsRules here
  );

  crawlResult.allAttemptedAbsoluteUrls.forEach(url => allFoundAbsoluteUrlsSet.add(url));
  crawlResult.processableDomainUrls.forEach(url => processableUniqueAbsoluteUrlsSet.add(url));

  const allFoundArray = Array.from(allFoundAbsoluteUrlsSet);
  const processableArray = Array.from(processableUniqueAbsoluteUrlsSet);

  console.log(`[Crawler] Link extraction completed in ${(Date.now() - startTime)/1000}s. Found ${processableArray.length} unique processable links. Encountered ${allFoundArray.length} unique URLs in total (Sitemap contributes to both).`);
  return { 
    allFoundAbsoluteUrls: allFoundArray,
    processableUniqueAbsoluteUrls: processableArray 
  }; // Modified return value
} 