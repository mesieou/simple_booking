import * as cheerio from 'cheerio';
import normalizeUrl from 'normalize-url';
import { isValidLink } from '../validateUrl';

/**
 * Extracts and filters links from HTML content
 */
export function parseLinksFromHtml(html: string, baseUrl: string): string[] {
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
        stripWWW: false,
        removeTrailingSlash: true,
        removeQueryParameters: [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^msclkid$/i],
        sortQueryParameters: false
      });
      if (isValidLink(norm, base)) {
        links.add(norm);
      }
    } catch {}
  });
  return Array.from(links);
} 