import got from 'got';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import normalizeUrl from 'normalize-url';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
};

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

const SKIPPED_PARAMS = [
  'utm_', 'ref_', 'source_', 'campaign_', 'medium_',
  'fbclid', 'gclid', 'msclkid', 'dclid',
  'share', 'share=', 'share?',
  'print', 'print=', 'print?',
  'preview', 'preview=', 'preview?'
];

const SKIPPED_PATTERNS = [
  /\/tag\//i,
  /\/author\//i,
  /\/category\//i,
  /\/archive\//i,
  /\/feed\//i,
  /\/rss\//i,
  /\/atom\//i,
  /\/sitemap\//i,
  /\/wp-/i,
  /\/wp-content\//i,
  /\/wp-includes\//i,
  /\/wp-admin\//i,
  /\/wp-json\//i,
  /\/wp-login\//i,
  /\/wp-register\//i,
  /\/wp-signup\//i,
  /\/wp-cron\//i,
  /\/wp-trackback\//i,
  /\/wp-comments\//i,
  /\/wp-feed\//i,
  /\/wp-rss\//i,
  /\/wp-atom\//i,
  /\/wp-rdf\//i,
  /\/wp-rss2\//i,
  /\/wp-rss3\//i,
  /\/wp-rss4\//i,
  /\/wp-rss5\//i,
  /\/wp-rss6\//i,
  /\/wp-rss7\//i,
  /\/wp-rss8\//i,
  /\/wp-rss9\//i,
  /\/wp-rss10\//i,
  /\/wp-rss11\//i,
  /\/wp-rss12\//i,
  /\/wp-rss13\//i,
  /\/wp-rss14\//i,
  /\/wp-rss15\//i,
  /\/wp-rss16\//i,
  /\/wp-rss17\//i,
  /\/wp-rss18\//i,
  /\/wp-rss19\//i,
  /\/wp-rss20\//i
];

function isValidUrl(url: string, baseUrl: URL): boolean {
  try {
    const parsedUrl = new URL(url);
    const canonicalUrl = normalizeUrl(url, {
      stripHash: true,
      stripWWW: true,
      removeTrailingSlash: true,
      removeQueryParameters: [/^utm_/i, /^ref_/i],
      sortQueryParameters: true
    });
    
    // Skip URLs with hash fragments
    if (parsedUrl.hash) {
      return false;
    }

    // Skip URLs with file extensions
    const pathname = parsedUrl.pathname.toLowerCase();
    if (SKIPPED_EXTENSIONS.some(ext => pathname.endsWith(ext))) {
      return false;
    }

    // Skip URLs with certain query parameters
    const searchParams = parsedUrl.searchParams;
    if (SKIPPED_PARAMS.some(param => 
      Array.from(searchParams.keys()).some(key => key.startsWith(param))
    )) {
      return false;
    }

    // Skip URLs with certain patterns
    if (SKIPPED_PATTERNS.some(pattern => pattern.test(pathname))) {
      return false;
    }

    return (
      parsedUrl.hostname === baseUrl.hostname &&
      parsedUrl.protocol === baseUrl.protocol
    );
  } catch {
    return false;
  }
}

export async function getLinks(baseUrl: string): Promise<string[]> {
  try {
    const res = await got(baseUrl, { headers: HEADERS, timeout: { request: 10000 } });
    const $ = cheerio.load(res.body);

    const parsedBase = new URL(baseUrl);
    const validLinks = new Set<string>();

    console.log(`\nExtracting links from ${baseUrl}:`);

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return;

      try {
        const fullUrl = new URL(href, parsedBase).toString();
        const parsed = new URL(fullUrl);

        // Only process internal links
        if (parsed.origin === parsedBase.origin) {
          const cleanUrl = normalizeUrl(fullUrl, {
            stripHash: true,
            stripWWW: true,
            removeTrailingSlash: true,
            removeQueryParameters: [/^utm_/i, /^ref_/i],
            sortQueryParameters: true
          });

          if (isValidUrl(cleanUrl, parsedBase)) {
            validLinks.add(cleanUrl);
            console.log('Valid:', cleanUrl);
          } else {
            console.log('Skipped:', cleanUrl);
          }
        }
      } catch {
        // Ignore malformed URLs
      }
    });

    console.log('\nSummary:');
    console.log(`Valid links found: ${validLinks.size}`);

    return Array.from(validLinks);
  } catch (err: any) {
    console.warn(`⚠️ Error fetching ${baseUrl}: ${err.message}`);
    return [];
  }
} 