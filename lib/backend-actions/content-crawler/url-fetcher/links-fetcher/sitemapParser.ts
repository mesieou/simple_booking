import * as cheerio from 'cheerio';
import { DEFAULT_HEADERS, URL_VALIDATION_CONFIG } from '@/lib/general-config/general-config';
import { isValidLink } from '../validateUrl'; // Assuming this can be used for basic validation
import normalizeUrl from 'normalize-url';
import { RobotsRules, isUrlAllowed } from '../robotsParser'; // Import robots types and checker

/**
 * Fetches the content of a given sitemap URL.
 * @param sitemapUrl The URL of the sitemap to fetch.
 * @returns A Promise resolving to the sitemap XML content as a string, or null if fetching fails.
 */
async function _fetchSitemapXmlContent(sitemapUrl: string): Promise<string | null> {
  try {
    // Attempt to fetch the sitemap content using default headers.
    const response = await fetch(sitemapUrl, { headers: DEFAULT_HEADERS });
    if (!response.ok) {
      // Log a warning if the HTTP response is not successful (e.g., 404, 500).
      console.warn(`[SitemapParser] Failed to fetch sitemap ${sitemapUrl}: ${response.status} ${response.statusText}`);
      return null;
    }
    // Return the response body as text.
    return await response.text();
  } catch (error) {
    // Log any errors that occur during the fetch operation (e.g., network issues).
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[SitemapParser] Error fetching sitemap ${sitemapUrl}:`, errorMessage);
    return null;
  }
}

/**
 * Extracts URLs of other sitemaps from a sitemap index XML content.
 * @param xmlContent The XML content of the sitemap index.
 * @param sitemapBaseUrl The base URL of the sitemap index file, used for resolving relative sitemap URLs.
 * @returns An array of absolute URLs pointing to other sitemap files.
 */
function _extractSitemapIndexUrls(xmlContent: string, sitemapBaseUrl: URL): string[] {
  const $ = cheerio.load(xmlContent, { xmlMode: true });
  const sitemapIndexUrls = new Set<string>();

  // Find all <loc> elements within <sitemapindex> <sitemap>.
  $('sitemapindex > sitemap > loc').each((_, element) => {
    const sitemapUrlText = $(element).text();
    if (sitemapUrlText) {
      try {
        // Resolve the found sitemap URL (which could be relative) against the sitemap index's base URL.
        const absoluteSitemapUrl = new URL(sitemapUrlText, sitemapBaseUrl.href).href;
        sitemapIndexUrls.add(absoluteSitemapUrl);
      } catch (e) {
        console.warn(`[SitemapParser] Invalid sitemap URL found in sitemap index: ${sitemapUrlText}`, e instanceof Error ? e.message : String(e));
      }
    }
  });
  return Array.from(sitemapIndexUrls);
}

/**
 * Extracts and validates page URLs from a standard sitemap XML content (urlset).
 * @param xmlContent The XML content of the sitemap.
 * @param sitemapBaseUrl The base URL of the sitemap file, used for resolving relative page URLs and for domain validation.
 * @param robotsRules The parsed robots.txt rules for the site.
 * @param siteRootUrlString The root URL string of the website, used for robots.txt checks.
 * @returns An array of validated and normalized absolute page URLs.
 */
function _extractPageUrlsFromSitemap(
  xmlContent: string,
  sitemapBaseUrl: URL, // Used for resolving relative URLs within *this* sitemap and for isValidLink
  robotsRules: RobotsRules | null,
  siteRootUrlString: string // The overall website root for robots.txt
): string[] {
  const $ = cheerio.load(xmlContent, { xmlMode: true });
  const pageUrls = new Set<string>();

  // Find all <loc> elements within <urlset> <url>.
  $('urlset > url > loc').each((_, element) => {
    const pageUrlText = $(element).text();
    if (pageUrlText) {
      try {
        // Resolve the page URL against the current sitemap's base URL.
        const absolutePageUrl = new URL(pageUrlText, sitemapBaseUrl.href).href;
        // Normalize the resolved page URL using options from global config.
        const normalizedUrl = normalizeUrl(absolutePageUrl, URL_VALIDATION_CONFIG.SITEMAP_NORMALIZATION_OPTIONS);
        
        // Validate the URL: check against robots.txt and ensure it belongs to the target domain.
        if (isUrlAllowed(normalizedUrl, robotsRules, siteRootUrlString) && isValidLink(normalizedUrl, sitemapBaseUrl)) {
          pageUrls.add(normalizedUrl);
        } else if (!isUrlAllowed(normalizedUrl, robotsRules, siteRootUrlString)) {
          // Optionally log URLs disallowed by robots.txt if verbose logging is desired.
          // console.log(`[SitemapParser] URL from sitemap disallowed by robots.txt: ${normalizedUrl}`);
        }
      } catch (e) {
        console.warn(`[SitemapParser] Invalid page URL found in sitemap: ${pageUrlText}`, e instanceof Error ? e.message : String(e));
      }
    }
  });
  return Array.from(pageUrls);
}

/**
 * Parses sitemap XML content to extract either sitemap index URLs or page URLs.
 * @param xmlContent The XML content string of the sitemap.
 * @param sitemapUrlForContext The URL from which this sitemap XML was fetched, used as a base for resolving relative links within it.
 * @param robotsRules Parsed robots.txt rules for the site.
 * @param siteRootUrlString The root URL string of the website for robots.txt context.
 * @returns A Promise resolving to an array of discovered URLs (either sitemap index URLs or page URLs).
 */
async function _parseSitemapXml(
  xmlContent: string, 
  sitemapUrlForContext: URL, // Base URL for resolving links *within this specific sitemap file*
  robotsRules: RobotsRules | null, 
  siteRootUrlString: string // Root site URL for robots.txt
  ): Promise<string[]> {
  
  // Attempt to extract sitemap index URLs first.
  const sitemapIndexUrls = _extractSitemapIndexUrls(xmlContent, sitemapUrlForContext);
  if (sitemapIndexUrls.length > 0) {
    return sitemapIndexUrls; // If it's a sitemap index, return these URLs.
  }

  // If not a sitemap index (or no index URLs found), attempt to extract page URLs.
  const pageUrls = _extractPageUrlsFromSitemap(xmlContent, sitemapUrlForContext, robotsRules, siteRootUrlString);
  return pageUrls;
}

/**
 * Fetches and parses a website's sitemap (including sitemap indexes) to discover page URLs.
 * It starts with /sitemap.xml and follows sitemap index links if present.
 * All discovered page URLs are validated against robots.txt and basic domain rules.
 *
 * @param siteRootUrlString The root URL string of the website (e.g., https://www.example.com).
 * @param robotsRules Parsed robots.txt rules for the site.
 * @returns A Promise resolving to an array of unique, validated page URLs found through sitemap exploration.
 */
export async function fetchUrlsFromSitemap(siteRootUrlString: string, robotsRules: RobotsRules | null): Promise<string[]> {
  let siteBaseUrlObject: URL;
  try {
    siteBaseUrlObject = new URL(siteRootUrlString);
  } catch (error) {
    console.error(`[SitemapParser] Invalid siteRootUrlString provided: ${siteRootUrlString}. Cannot fetch sitemap.`, error);
    return [];
  }

  // Construct the URL for the primary /sitemap.xml file.
  const primarySitemapUrlString = new URL('/sitemap.xml', siteBaseUrlObject).href;
  console.log(`[SitemapParser] Attempting to fetch and parse primary sitemap: ${primarySitemapUrlString}`);

  // Fetch the content of the primary sitemap.
  const primarySitemapXml = await _fetchSitemapXmlContent(primarySitemapUrlString);
  if (!primarySitemapXml) {
    console.warn(`[SitemapParser] No content fetched from primary sitemap: ${primarySitemapUrlString}.`);
    return []; // If primary sitemap fetch fails, return empty.
  }

  // Parse the primary sitemap content.
  let discoveredUrls = await _parseSitemapXml(primarySitemapXml, new URL(primarySitemapUrlString), robotsRules, siteRootUrlString);

  // Separate sitemap index URLs from page URLs discovered so far.
  const sitemapIndexUrlsToExplore: string[] = [];
  const finalPageUrls = new Set<string>();

  discoveredUrls.forEach(url => {
    // A simple heuristic: if a URL from a sitemap ends with .xml, it's likely another sitemap (index or direct).
    if (url.toLowerCase().endsWith('.xml')) { 
      sitemapIndexUrlsToExplore.push(url);
    } else {
      finalPageUrls.add(url); // Assumed to be a page URL, already validated by _parseSitemapXml if it came from <urlset>
    }
  });

  // Explore any sitemap index URLs found in the primary sitemap or subsequent indexes.
  const exploredSitemapIndexes = new Set<string>([primarySitemapUrlString]); // Avoid re-processing the primary sitemap.

  let currentIndex = 0;
  while (currentIndex < sitemapIndexUrlsToExplore.length) {
    const currentSitemapIndexUrl = sitemapIndexUrlsToExplore[currentIndex];
    currentIndex++;

    if (exploredSitemapIndexes.has(currentSitemapIndexUrl)) {
      continue; // Skip if this sitemap index has already been processed.
    }
    exploredSitemapIndexes.add(currentSitemapIndexUrl);
    
    console.log(`[SitemapParser] Exploring sitemap index: ${currentSitemapIndexUrl}`);
    const sitemapXml = await _fetchSitemapXmlContent(currentSitemapIndexUrl);
    if (sitemapXml) {
      try {
        // Parse this newly fetched sitemap content.
        const urlsFromThisSitemap = await _parseSitemapXml(sitemapXml, new URL(currentSitemapIndexUrl), robotsRules, siteRootUrlString);
        urlsFromThisSitemap.forEach(url => {
          if (url.toLowerCase().endsWith('.xml')) {
            // If it's another sitemap index URL, add it to the list to explore.
            if (!exploredSitemapIndexes.has(url) && !sitemapIndexUrlsToExplore.includes(url)) {
                sitemapIndexUrlsToExplore.push(url);
            }
          } else {
            // If it's a page URL, add to the final set (already validated).
            finalPageUrls.add(url);
          }
        });
      } catch (error) {
        console.warn(`[SitemapParser] Failed to parse content from sitemap ${currentSitemapIndexUrl}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }
  
  // Return the unique, validated page URLs.
  return Array.from(finalPageUrls);
} 