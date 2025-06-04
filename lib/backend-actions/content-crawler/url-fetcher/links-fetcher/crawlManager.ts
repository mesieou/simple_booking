import { CrawlConfig } from '@/lib/general-config/general-config';
import { crawlDomainLinksBreadthFirst } from './linkCrawler';
import { fetchUrlsFromSitemap } from './sitemapParser';
import { RobotsRules, isUrlAllowed } from '../robotsParser';

/**
 * Fetches URLs from the sitemap, normalizes them, and optionally filters them by robots.txt.
 * Note: `fetchUrlsFromSitemap` already filters by robots.txt, so direct filtering here is redundant.
 * @param config The crawl configuration, containing the websiteUrl and sitemap usage flag.
 * @param robotsRules Parsed robots.txt rules for the site.
 * @param baseHref The base href string of the website, for URL normalization if any sitemap URLs were relative (though unlikely).
 * @returns A Promise resolving to an object containing all unique absolute URLs found in the sitemap.
 */
async function _getUrlsFromSitemapIfEnabled(
  config: CrawlConfig,
  robotsRules: RobotsRules | null,
  baseHref: string
): Promise<{ sitemapUrls: string[] }> {
  if (config.useSitemap === false) { // Only skip if explicitly false
    console.log('[CrawlManager] Sitemap usage is explicitly disabled in config.');
    return { sitemapUrls: [] };
  }

  let rawSitemapUrls: string[] = [];
  try {
    // fetchUrlsFromSitemap is expected to return absolute, normalized, and robots.txt-allowed URLs.
    rawSitemapUrls = await fetchUrlsFromSitemap(config.websiteUrl!, robotsRules);
    if (rawSitemapUrls.length > 0) {
      console.log(`[CrawlManager] Found ${rawSitemapUrls.length} URLs via sitemap.`);
    } else {
      console.log('[CrawlManager] No URLs found via sitemap or sitemap was not accessible.');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[CrawlManager] Error fetching or parsing sitemap for ${config.websiteUrl}:`, errorMessage);
    return { sitemapUrls: [] }; // Return empty if sitemap processing fails.
  }
  
  // Normalize URLs just in case, though fetchUrlsFromSitemap should ideally handle this.
  // And since fetchUrlsFromSitemap already filters by robots.txt, further filtering here isn't strictly needed.
  const normalizedAndUniqueSitemapUrls = Array.from(new Set(
    rawSitemapUrls.map(url => {
      try {
        return new URL(url, baseHref).href; // Ensure they are absolute and consistently formatted.
      } catch (e) {
        console.warn(`[CrawlManager] Invalid URL from sitemap after processing: ${url}`);
        return null; // Skip invalid URLs
      }
    }).filter((url): url is string => url !== null)
  ));

  return { sitemapUrls: normalizedAndUniqueSitemapUrls };
}

/**
 * Manages the crawling process to extract all relevant links from a website.
 * It first attempts to use the sitemap if enabled, then performs a breadth-first crawl of the domain.
 *
 * @param config The crawl configuration, including websiteUrl, maxPages, concurrency, maxDepth, and useSitemap flag.
 * @param robotsRules Parsed robots.txt rules for the site.
 * @returns A Promise resolving to an object containing all unique absolute URLs found (allFoundAbsoluteUrls) 
 *          and all unique, processable absolute URLs (processableUniqueAbsoluteUrls) that respect robots.txt and domain scope.
 */
export async function crawlWebsiteForLinks(
  config: CrawlConfig,
  robotsRules: RobotsRules | null
): Promise<{ allFoundAbsoluteUrls: string[], processableUniqueAbsoluteUrls: string[] }> {
  if (!config.websiteUrl) {
    throw new Error('websiteUrl is required for crawling in CrawlConfig');
  }
  
  const siteRootHref = new URL(config.websiteUrl).href; // Ensure a clean, absolute base href.
  console.log(`[CrawlManager] Starting link discovery for: ${siteRootHref}`);
  const startTime = Date.now();

  // Step 1: Fetch and process URLs from the sitemap if enabled.
  const { sitemapUrls } = await _getUrlsFromSitemapIfEnabled(config, robotsRules, siteRootHref);
  
  // Initialize sets for all discovered URLs and those that are processable (respecting robots.txt, domain, etc.).
  // Sitemap URLs are already filtered by robots.txt by the sitemapParser.
  const allFoundAbsoluteUrlsSet = new Set<string>(sitemapUrls);
  const processableUniqueAbsoluteUrlsSet = new Set<string>(sitemapUrls);

  // Step 2: Perform a breadth-first crawl starting from the websiteUrl to discover more links.
  // crawlDomainLinksBreadthFirst will also handle robots.txt internally for the links it processes.
  const crawlResult = await crawlDomainLinksBreadthFirst(
    siteRootHref, // Start crawl from the normalized site root.
    config.maxPages || 100,
    config.concurrency || 5,
    config.maxDepth ?? 4, // Default to 4 if not specified, allowing reasonable depth.
    robotsRules
  );

  // Step 3: Merge results from sitemap and domain crawl.
  // Add all URLs attempted/considered by the crawler to the overall set of found URLs.
  crawlResult.allAttemptedAbsoluteUrls.forEach(url => allFoundAbsoluteUrlsSet.add(url));
  // Add all domain-specific, processable URLs found by the crawler.
  crawlResult.processableDomainUrls.forEach(url => processableUniqueAbsoluteUrlsSet.add(url));

  const allFoundArray = Array.from(allFoundAbsoluteUrlsSet);
  const processableArray = Array.from(processableUniqueAbsoluteUrlsSet);

  const durationSeconds = (Date.now() - startTime) / 1000;
  console.log(`[CrawlManager] Link discovery completed in ${durationSeconds.toFixed(2)}s. Found ${processableArray.length} unique processable links. Encountered ${allFoundArray.length} unique URLs in total.`);
  
  return { 
    allFoundAbsoluteUrls: allFoundArray,
    processableUniqueAbsoluteUrls: processableArray 
  };
} 