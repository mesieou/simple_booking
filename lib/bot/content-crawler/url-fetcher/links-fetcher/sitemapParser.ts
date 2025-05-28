import * as cheerio from 'cheerio';
import { DEFAULT_HEADERS } from '@/lib/config/config';
import { isValidLink } from '../validateUrl'; // Assuming this can be used for basic validation
import normalizeUrl from 'normalize-url';
import { RobotsRules, isUrlAllowed } from '../robotsParser'; // Import robots types and checker

async function fetchSitemapContent(sitemapUrl: string): Promise<string | null> {
  try {
    const response = await fetch(sitemapUrl, { headers: DEFAULT_HEADERS });
    if (!response.ok) {
      console.warn(`[SitemapParser] Failed to fetch sitemap ${sitemapUrl}: ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.warn(`[SitemapParser] Error fetching sitemap ${sitemapUrl}:`, error);
    return null;
  }
}

async function parseSitemap(xmlContent: string, baseUrl: URL, robotsRules: RobotsRules | null, baseUrlString: string): Promise<string[]> {
  const $ = cheerio.load(xmlContent, { xmlMode: true });
  const urls = new Set<string>();

  // Handle sitemap index files - these are URLs to other sitemaps, not pages to be checked by robots.txt here
  $('sitemapindex > sitemap > loc').each((_, element) => {
    const sitemapUrl = $(element).text();
    try {
        // Normalize sitemap URLs if they are relative, though typically they are absolute
        const absoluteSitemapUrl = new URL(sitemapUrl, baseUrl.href).href;
        urls.add(absoluteSitemapUrl); 
    } catch (e) {
        console.warn(`[SitemapParser] Invalid sitemap URL found in index: ${sitemapUrl}`, e);
    }
  });

  // Handle regular sitemaps (page URLs)
  $('urlset > url > loc').each((_, element) => {
    const pageUrl = $(element).text();
    try {
      const absoluteUrl = new URL(pageUrl, baseUrl.href).href;
      const normalized = normalizeUrl(absoluteUrl, {
        stripHash: true,
        stripWWW: false,
        removeTrailingSlash: true,
        removeQueryParameters: [/^utm_/i]
      });
      // Check against robots.txt and ensure it's a valid link for the domain
      if (isUrlAllowed(normalized, robotsRules, baseUrlString) && isValidLink(normalized, baseUrl)) { 
        urls.add(normalized);
      } else if (!isUrlAllowed(normalized, robotsRules, baseUrlString)) {
        console.log(`[SitemapParser] URL from sitemap disallowed by robots.txt: ${normalized}`);
      }
    } catch (e) {
      console.warn(`[SitemapParser] Invalid page URL found in sitemap: ${pageUrl}`, e);
    }
  });

  return Array.from(urls);
}

export async function fetchUrlsFromSitemap(baseUrlString: string, robotsRules: RobotsRules | null): Promise<string[]> {
  const baseUrl = new URL(baseUrlString);
  const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;
  console.log(`[SitemapParser] Attempting to fetch and parse sitemap: ${sitemapUrl}`);

  const mainSitemapContent = await fetchSitemapContent(sitemapUrl);
  if (!mainSitemapContent) {
    return [];
  }

  // Pass robotsRules and baseUrlString to parseSitemap
  let allDiscoveredUrls = await parseSitemap(mainSitemapContent, baseUrl, robotsRules, baseUrlString);

  const sitemapIndexUrls = allDiscoveredUrls.filter(url => url.toLowerCase().includes('sitemap') && url.toLowerCase().endsWith('.xml'));
  const pageUrls = new Set(allDiscoveredUrls.filter(url => !sitemapIndexUrls.includes(url))); // Use Set for initial page URLs for auto-deduplication

  if (sitemapIndexUrls.length > 0) {
    console.log(`[SitemapParser] Found ${sitemapIndexUrls.length} potential sitemap index files. Parsing them...`);
    for (const indexUrl of sitemapIndexUrls) {
      if (indexUrl === sitemapUrl) continue; // Avoid re-fetching the main sitemap
      
      const indexContent = await fetchSitemapContent(indexUrl);
      if (indexContent) {
        try {
            // Pass robotsRules and baseUrlString to recursive parseSitemap calls
            const urlsFromIndex = await parseSitemap(indexContent, baseUrl, robotsRules, baseUrlString);
            urlsFromIndex.forEach(u => {
              // If 'u' is another sitemap index, it will be handled by the outer logic in a flat manner (no deep recursion here)
              // If 'u' is a page URL, it would have already been checked by robots.txt inside parseSitemap
              // We add to pageUrls Set to handle deduplication naturally
              pageUrls.add(u); 
            });
        } catch (error) {
            console.warn(`[SitemapParser] Failed to parse sitemap index ${indexUrl}:`, error);
        }
      }
    }
  }
  // Final list of page URLs, already filtered by robots.txt and de-duplicated
  return Array.from(pageUrls);
} 