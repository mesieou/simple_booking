import normalizeUrl from 'normalize-url';
import * as cheerio from 'cheerio';
import { DEFAULT_HEADERS } from './constants';
import { detectLanguage, isLikelyImportantUrl, extractNavAndFooterLinks } from './utils';

// Only keep the constants used by the recursive crawl logic
const SOCIAL_DOMAINS = [
  'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com',
  'youtube.com', 'tiktok.com', 'pinterest.com', 'whatsapp.com',
];
const SKIPPED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.tar', '.gz', '.7z',
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv',
  '.css', '.js', '.json', '.xml', '.txt'
];

// Build SKIPPED_PATTERNS dynamically
const basePatterns = [
  /\/tag\//i, /\/category\/page\//i, /\/archive\//i, /\/feed\//i, /\/rss\//i, /\/atom\//i,
  /\/sitemap\//i, /\/wp-/i, /\/wp-content\//i, /\/wp-includes\//i, /\/wp-admin\//i,
  /\/(page|p)[-_]?\d+/i, // e.g. /page_2
  /\/\d{4}\/\d{2}\/\d{2}/i, // date-based blog traps
];
const blogPatterns = [
  /\/(post|article|news|blog)[-_]?\d+/i, // e.g. /blog-23
  /\/blog\//i, /\/news\//i, /\/article\//i, /\/posts\//i
];
const productPatterns = [
  /\/product\/.+/i
];
const SKIPPED_PATTERNS = [
  ...basePatterns,
  ...blogPatterns,
  ...productPatterns,
  /\?page=\d+/i, // skip paginated URLs
  /\?p=\d+/i,    // skip WordPress paginated URLs
  /\/search\//i,  // skip search pages
  /\/cart\//i,    // skip cart pages
  /\/checkout\//i, // skip checkout pages
  /\/admin\//i,   // skip admin pages
  /\/user\//i,    // skip user pages
  /\/profile\//i  // skip profile pages
];

function isValidLink(url: string, baseUrl: URL): boolean {
  try {
    const parsedUrl = new URL(url);
    // Only allow same domain or subdomain
    if (
      parsedUrl.hostname !== baseUrl.hostname &&
      !parsedUrl.hostname.endsWith('.' + baseUrl.hostname)
    ) {
      return false;
    }
    // Skip social
    if (SOCIAL_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) return false;
    // Skip file extensions
    const pathname = parsedUrl.pathname.toLowerCase();
    if (SKIPPED_EXTENSIONS.some(ext => pathname.endsWith(ext))) return false;
    // Skip patterns
    if (SKIPPED_PATTERNS.some(pattern => pattern.test(pathname))) return false;
    return true;
  } catch {
    return false;
  }
}

function extractAndFilterLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: Set<string> = new Set();
  const base = new URL(baseUrl);
  $('a[href]').each((_, el) => {
    let href = $(el).attr('href');
    if (!href) return;
    try {
      const url = new URL(href, baseUrl);
      const norm = normalizeUrl(url.href, {
        stripHash: true,
        stripWWW: true,
        removeTrailingSlash: true,
        removeQueryParameters: [/^utm_/i, /^ref_/i],
        sortQueryParameters: true
      });
      if (isValidLink(norm, base)) {
        links.add(norm);
      }
    } catch {}
  });
  return Array.from(links);
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// --- CONCURRENT, BREADTH-FIRST CRAWLER ---

/**
 * Fast, concurrency-limited, breadth-first crawler with language filtering.
 * @param startUrl The starting URL
 * @param maxPages Maximum number of pages to crawl
 * @param concurrency Maximum number of concurrent fetches (default 5)
 * @param mainLanguage The language code to restrict crawling to (e.g., 'en')
 * @param maxDepth Maximum depth of crawl (default 2)
 * @param skipProductPages Whether to skip product pages (default true)
 * @param skipBlogPages Whether to skip blog pages (default true)
 * @returns Array of discovered URLs (same domain and language)
 */
export async function getAllDomainLinksRecursive(
  startUrl: string,
  maxPages: number = 50,
  concurrency: number = 5,
  mainLanguage?: string,
  maxDepth: number = 2,
  skipProductPages: boolean = true,
  skipBlogPages: boolean = true
): Promise<string[]> {
  const visited = new Set<string>();
  // Each queue item: { url, depth }
  const queue: { url: string, depth: number }[] = [{ url: startUrl, depth: 0 }];
  const base = new URL(startUrl);
  let active = 0;
  let done = false;
  // Inlink counting
  const inlinkCount: Record<string, number> = {};

  // Build SKIPPED_PATTERNS dynamically
  const basePatterns = [
    /\/tag\//i, /\/category\/page\//i, /\/archive\//i, /\/feed\//i, /\/rss\//i, /\/atom\//i,
    /\/sitemap\//i, /\/wp-/i, /\/wp-content\//i, /\/wp-includes\//i, /\/wp-admin\//i,
    /\/(page|p)[-_]?\d+/i, // e.g. /page_2
    /\/\d{4}\/\d{2}\/\d{2}/i, // date-based blog traps
  ];
  const blogPatterns = [
    /\/(post|article|news|blog)[-_]?\d+/i, // e.g. /blog-23
    /\/blog\//i, /\/news\//i, /\/article\//i, /\/posts\//i
  ];
  const productPatterns = [
    /\/product\/.+/i
  ];
  const SKIPPED_PATTERNS = [
    ...basePatterns,
    ...(skipBlogPages ? blogPatterns : []),
    ...(skipProductPages ? productPatterns : []),
    /\?page=\d+/i, // skip paginated URLs
    /\?p=\d+/i,    // skip WordPress paginated URLs
    /\/search\//i,  // skip search pages
    /\/cart\//i,    // skip cart pages
    /\/checkout\//i, // skip checkout pages
    /\/admin\//i,   // skip admin pages
    /\/user\//i,    // skip user pages
    /\/profile\//i  // skip profile pages
  ];

  function isValidLinkWithConfig(url: string, baseUrl: URL): boolean {
    try {
      const parsedUrl = new URL(url);
      if (
        parsedUrl.hostname !== baseUrl.hostname &&
        !parsedUrl.hostname.endsWith('.' + baseUrl.hostname)
      ) {
        return false;
      }
      if (SOCIAL_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) return false;
      const pathname = parsedUrl.pathname.toLowerCase();
      if (SKIPPED_EXTENSIONS.some(ext => pathname.endsWith(ext))) return false;
      if (SKIPPED_PATTERNS.some(pattern => pattern.test(pathname))) return false;
      return true;
    } catch {
      return false;
    }
  }

  function extractAndFilterLinksWithConfig(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const links: Set<string> = new Set();
    const base = new URL(baseUrl);
    $('a[href]').each((_, el) => {
      let href = $(el).attr('href');
      if (!href) return;
      try {
        const url = new URL(href, baseUrl);
        const norm = normalizeUrl(url.href, {
          stripHash: true,
          stripWWW: true,
          removeTrailingSlash: true,
          removeQueryParameters: [/^utm_/i, /^ref_/i],
          sortQueryParameters: true
        });
        if (isValidLinkWithConfig(norm, base)) {
          links.add(norm);
        }
      } catch {}
    });
    return Array.from(links);
  }

  async function worker() {
    while (queue.length > 0 && visited.size < maxPages && !done) {
      queue.sort((a, b) => (inlinkCount[b.url] || 0) - (inlinkCount[a.url] || 0));
      const { url, depth } = queue.shift()!;
      if (!url) break;
      const normUrl = normalizeUrl(url, {
        stripHash: true,
        stripWWW: true,
        removeTrailingSlash: true,
        removeQueryParameters: [/^utm_/i, /^ref_/i],
        sortQueryParameters: true
      });
      if (visited.has(normUrl)) continue;
      // Filter out non-important URLs
      if (!isLikelyImportantUrl(normUrl)) {
        continue;
      }
      visited.add(normUrl);
      active++;
      try {
        const html = await fetchHtml(normUrl);
        if (html) {
          if (mainLanguage) {
            const detectedLang = detectLanguage(normUrl, html);
            if (detectedLang !== mainLanguage) {
              continue;
            }
          }
          if (depth >= maxDepth) {
            continue;
          }
          const navFooterLinks = extractNavAndFooterLinks(html).map(link => {
            try {
              return normalizeUrl(new URL(link, base.href).href, {
                stripHash: true,
                stripWWW: true,
                removeTrailingSlash: true,
                removeQueryParameters: [/^utm_/i, /^ref_/i],
                sortQueryParameters: true
              });
            } catch { return null; }
          }).filter(Boolean) as string[];
          const links = extractAndFilterLinksWithConfig(html, base.href)
            .filter(link => {
              if (!mainLanguage) return true;
              const urlLang = detectLanguage(link, '');
              return urlLang === 'unknown' || urlLang === mainLanguage;
            })
            .map(link => {
              try {
                return normalizeUrl(link, {
                  stripHash: true,
                  stripWWW: true,
                  removeTrailingSlash: true,
                  removeQueryParameters: [/^utm_/i, /^ref_/i],
                  sortQueryParameters: true
                });
              } catch { return null; }
            })
            .filter(Boolean) as string[];
          for (const l of [...navFooterLinks, ...links]) {
            inlinkCount[l] = (inlinkCount[l] || 0) + 1;
          }
          const importantLinks = Array.from(new Set([
            ...navFooterLinks,
            ...links.filter(isLikelyImportantUrl)
          ])).filter(l => !visited.has(l) && !queue.some(q => q.url === l));
          const otherLinks = links.filter(l => !importantLinks.includes(l) && !visited.has(l) && !queue.some(q => q.url === l));
          queue.unshift(...importantLinks.map(l => ({ url: l, depth: depth + 1 })));
          queue.push(...otherLinks.map(l => ({ url: l, depth: depth + 1 })));
        }
      } catch {}
      active--;
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  done = true;
  return Array.from(visited);
} 