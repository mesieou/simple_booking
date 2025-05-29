import * as cheerio from 'cheerio';
import normalizeUrl from 'normalize-url';
import { isValidLink } from '../validateUrl';

/** Normalization options for URLs extracted from links. */
const URL_NORMALIZATION_OPTIONS = {
  stripHash: true,
  stripWWW: false, // Keep www as it can sometimes lead to different content/sites
  removeTrailingSlash: true,
  removeQueryParameters: [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^msclkid$/i], // Common tracking parameters
  sortQueryParameters: false, // Keep original query parameter order for now
};

/**
 * Processes a single href attribute value: resolves it against a base URL,
 * normalizes it, and validates if it's a valid link within the same domain context.
 *
 * @param href The raw href attribute value from an anchor tag.
 * @param baseUrl The base URL of the page from which the href was extracted, used for resolving relative links.
 * @param baseDomainUrl A URL object representing the base domain, used for validation against the same domain.
 * @returns The normalized and validated URL string if valid, otherwise null.
 */
function _processSingleHref(href: string, baseUrl: string, baseDomainUrl: URL): string | null {
  try {
    // Step 1: Resolve the href to an absolute URL using the page's base URL.
    const absoluteUrl = new URL(href, baseUrl).toString();

    // Step 2: Normalize the absolute URL.
    const normalizedUrl = normalizeUrl(absoluteUrl, URL_NORMALIZATION_OPTIONS);

    // Step 3: Validate if the normalized URL is a valid link according to domain rules.
    if (isValidLink(normalizedUrl, baseDomainUrl)) {
      return normalizedUrl;
    }
  } catch (error) {
    // Log or handle errors during URL parsing or normalization if needed, e.g.:
    // console.warn(`[linkParser] Error processing href '${href}' with base '${baseUrl}':`, error);
    return null; // Indicate failure to process this href.
  }
  return null; // If not valid after checks.
}

/**
 * Extracts, normalizes, and filters HTTP/HTTPS links from HTML content that belong to the same base domain.
 *
 * @param html The HTML content string to parse.
 * @param baseUrl The base URL of the page from which the HTML content was fetched. This is used to resolve relative links and determine the domain scope.
 * @returns An array of unique, normalized, and valid absolute URL strings found within the HTML.
 */
export function parseLinksFromHtml(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html); // Load HTML content into Cheerio for parsing.
  const uniqueLinks: Set<string> = new Set(); // Use a Set to automatically handle duplicate links.
  
  let baseDomainUrl: URL;
  try {
    baseDomainUrl = new URL(baseUrl);
  } catch (error) {
    console.error(`[linkParser] Invalid baseUrl provided: ${baseUrl}. Cannot parse links.`, error);
    return []; // Cannot proceed without a valid base URL.
  }
  
  // Iterate over all anchor tags with an href attribute.
  $('a[href]').each((_, element) => {
    const hrefAttribute = $(element).attr('href');
    if (!hrefAttribute) {
      return; // Skip if href attribute is missing or empty.
    }

    // Process, normalize, and validate the href.
    const processedLink = _processSingleHref(hrefAttribute, baseUrl, baseDomainUrl);
    if (processedLink) {
      uniqueLinks.add(processedLink); // Add the valid link to the set.
    }
  });

  return Array.from(uniqueLinks); // Convert the set of unique links to an array.
} 