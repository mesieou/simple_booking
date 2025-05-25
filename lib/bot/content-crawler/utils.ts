import crypto from 'crypto';
import { CrawlState, CONFIDENCE_CONFIG, Category, CATEGORY_DISPLAY_NAMES } from './config';
import { franc } from 'franc-min';
// Improved language detection using franc-min, robust content filtering, and detailed logging for debugging. Whitelist for important URLs and stricter thresholds for meaningful content.

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

export function cleanContent(content: string): string {
  return content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .replace(/\n+/g, '\n')   // Collapse newlines
    .replace(/[^\S\n]+/g, ' ') // Collapse spaces except newlines
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .replace(/\n\s*\n/g, '\n\n') // Collapse multiple empty lines
    .trim();
}

export function generateContentHash(content: string, lang: string): string {
  const normalizedContent = normalizeText(content);
  return crypto.createHash('sha256').update(normalizedContent + lang).digest('hex');
}

// Helper: Map ISO 639-3 to ISO 639-1 (partial, add more as needed)
const iso6393to1: Record<string, string> = {
  eng: 'en',
  por: 'pt',
  spa: 'es',
  deu: 'de',
  fra: 'fr',
  ita: 'it',
  nld: 'nl',
  rus: 'ru',
  // Add more as needed
};

export function mapIso6393to1(code: string): string {
  return iso6393to1[code] || code;
}

// Whitelist for important URLs (add more as needed)
const IMPORTANT_URLS = [
  '/about-us', '/contact-us', '/our-staff', '/ys-blob'
];

// URL-based language overrides for common language keywords
const URL_LANGUAGE_HINTS: Record<string, string> = {
  portuguese: 'pt',
  italian: 'it',
  french: 'fr',
  espanol: 'es',
  spanish: 'es',
  english: 'en',
  deutsch: 'de',
  german: 'de',
  chinese: 'zh',
  japanese: 'ja',
  // Add more as needed
};

export function detectLanguage(url: string, content: string): string {
  // Whitelist override for important URLs
  if (IMPORTANT_URLS.some(imp => url.includes(imp))) {
    return 'en'; // or your main language
  }

  // URL-based language hints
  for (const [hint, lang] of Object.entries(URL_LANGUAGE_HINTS)) {
    if (url.toLowerCase().includes(hint)) {
      return lang;
    }
  }

  // Check content language hints
  const langMatch = content.match(/lang=["']([a-z]{2})["']/i);
  if (langMatch) {
    return langMatch[1].toLowerCase();
  }

  // Use franc for language detection
  const francCode = franc(content);
  if (francCode === 'und') {
    return 'unknown';
  }
  const mapped = mapIso6393to1(francCode);
  return mapped;
}

export async function delayWithState(state: CrawlState): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - state.lastRequestTime;
  if (timeSinceLastRequest < state.config.requestDelay!) {
    await new Promise(resolve => setTimeout(resolve, state.config.requestDelay! - timeSinceLastRequest));
  }
  state.lastRequestTime = Date.now();
}

export function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

/**
 * Splits text into sentences using a regex. Handles basic English punctuation.
 */
export function splitIntoSentences(text: string): string[] {
  // This regex splits on period, exclamation, or question mark followed by space or end of string
  return text.match(/[^.!?\n]+[.!?]+(\s|$)|[^.!?\n]+$/g)?.map(s => s.trim()).filter(Boolean) || [];
}

export const PRICE_REGEX = /[$€£]\d+[\d,.]*/;

/**
 * Heuristic filter for low-value, empty, or boilerplate content.
 * Returns a string reason if the content is low value, or false if it is not.
 */
export function isLowValueContent(text: string): string | false {
  const trimmed = text.trim();
  if (trimmed.length < 100) {
    return 'too short';
  }

  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.length < 50) {
    return 'too few words';
  }

  const uniqueWords = new Set(words);
  if (uniqueWords.size / words.length > 0.7 && words.length > 30) {
    return 'too many unique words';
  }

  const sentenceCount = (trimmed.match(/[.!?]/g) || []).length;
  if (sentenceCount < 2 && words.length > 30) {
    return 'too few sentences';
  }

  if (/(coming soon|under construction|lorem ipsum)/i.test(trimmed)) {
    return 'boilerplate phrase';
  }

  return false;
}

/**
 * Returns true if the URL path is likely to be a high-value business page.
 */
export function isLikelyImportantUrl(url: string): boolean {
  return /about|contact|services|pricing|faq|book|appointment|quote|support|team|locations|get-in-touch|our-story|schedule|how-it-works|request|estimate|consult|demo|signup|register|login|account|dashboard/i.test(url);
}

/**
 * Extracts all links from <nav> and <footer> elements in the HTML.
 * Returns an array of absolute or relative hrefs.
 */
export function extractNavAndFooterLinks(html: string): string[] {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const links = new Set<string>();
  $('nav a[href], footer a[href]').each((_: unknown, el: Element) => {
    const href = $(el).attr('href');
    if (href) links.add(href);
  });
  return Array.from(links);
}

export async function runConcurrentTasks<T>(
  taskGenerator: () => AsyncGenerator<() => Promise<T>, void, unknown>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const workers = Array.from({ length: concurrency }, async () => {
    for await (const task of taskGenerator()) {
      const result = await task();
      results.push(result);
    }
  });
  await Promise.all(workers);
  return results.filter((result): result is T => result !== null);
}

/**
 * Validates and normalizes a confidence score
 * @param confidence The confidence score to validate
 * @returns Normalized confidence score between MIN_SCORE and MAX_SCORE
 */
export function validateConfidence(confidence: number): number {
  return Math.max(CONFIDENCE_CONFIG.MIN_SCORE, Math.min(CONFIDENCE_CONFIG.MAX_SCORE, confidence));
}

/**
 * Checks if a confidence score meets the minimum threshold
 * @param confidence The confidence score to check
 * @returns True if the score meets the minimum threshold
 */
export function meetsConfidenceThreshold(confidence: number): boolean {
  return confidence >= CONFIDENCE_CONFIG.MIN_THRESHOLD;
}

/**
 * Logs confidence score information
 * @param category The content category
 * @param confidence The confidence score
 * @param source The source of the confidence score (e.g., 'categorization', 'chunking')
 */
export function logConfidence(category: string, confidence: number, source: string): void {
  const status = confidence < CONFIDENCE_CONFIG.MIN_THRESHOLD ? 'LOW' :
                confidence < CONFIDENCE_CONFIG.WARNING_THRESHOLD ? 'WARNING' : 'GOOD';
  console.log(`[Confidence ${status}] Category: ${category}, Score: ${confidence.toFixed(2)}, Source: ${source}`);
}

/**
 * Maps a category number to its display name
 * @param category The category number
 * @returns The display name for the category
 */
export function getCategoryDisplayName(category: number): string {
  return CATEGORY_DISPLAY_NAMES[category as Category] || 'unknown';
}
