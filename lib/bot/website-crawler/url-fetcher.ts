import normalizeUrl from 'normalize-url';
import * as cheerio from 'cheerio';
import { DEFAULT_HEADERS } from './constants';

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
const SKIPPED_PATTERNS = [
  /\/tag\//i, /\/category\/page\//i, /\/archive\//i, /\/feed\//i, /\/rss\//i, /\/atom\//i,
  /\/sitemap\//i, /\/wp-/i, /\/wp-content\//i, /\/wp-includes\//i, /\/wp-admin\//i
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
 * Fast, concurrency-limited, breadth-first crawler.
 * @param startUrl The starting URL
 * @param maxPages Maximum number of pages to crawl
 * @param concurrency Maximum number of concurrent fetches (default 5)
 * @returns Array of discovered URLs (same domain)
 */
export async function getAllDomainLinksRecursive(startUrl: string, maxPages: number = 100, concurrency: number = 5): Promise<string[]> {
  const visited = new Set<string>();
  const queue: string[] = [startUrl];
  const base = new URL(startUrl);
  let active = 0;
  let done = false;

  async function worker() {
    while (queue.length > 0 && visited.size < maxPages && !done) {
      const url = queue.shift();
      if (!url) break;
      const normUrl = normalizeUrl(url, {
        stripHash: true,
        stripWWW: true,
        removeTrailingSlash: true,
        removeQueryParameters: [/^utm_/i, /^ref_/i],
        sortQueryParameters: true
      });
      if (visited.has(normUrl)) continue;
      visited.add(normUrl);
      active++;
      try {
        const html = await fetchHtml(normUrl);
        if (html) {
          const links = extractAndFilterLinks(html, base.href);
          for (const link of links) {
            if (visited.size + queue.length >= maxPages) break;
            const normLink = normalizeUrl(link, {
              stripHash: true,
              stripWWW: true,
              removeTrailingSlash: true,
              removeQueryParameters: [/^utm_/i, /^ref_/i],
              sortQueryParameters: true
            });
            if (!visited.has(normLink) && !queue.includes(normLink)) {
              queue.push(normLink);
            }
          }
        }
      } catch {}
      active--;
    }
  }

  // Start workers
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  done = true;
  return Array.from(visited);
} 