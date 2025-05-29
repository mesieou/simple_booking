import crypto from 'crypto';
import { CONFIDENCE_CONFIG } from '@/lib/config/config';
import { franc } from 'franc-min';
// Improved language detection using franc-min, robust content filtering, and detailed logging for debugging. Whitelist for important URLs and stricter thresholds for meaningful content.

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
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

interface DetectLanguageOptions {
  importantUrls?: string[];
  urlLanguageHints?: Record<string, string>;
  defaultLanguage?: string; // For the importantUrls override
}

export function detectLanguage(url: string, content: string, options?: DetectLanguageOptions): string {
  const importantUrls = options?.importantUrls || [];
  const urlLanguageHints = options?.urlLanguageHints || {};
  const defaultLangForImportant = options?.defaultLanguage || 'en'; // Default to 'en' if not specified

  // Whitelist override for important URLs
  if (importantUrls.some(imp => url.includes(imp))) {
    return defaultLangForImportant;
  }

  // URL-based language hints
  for (const [hint, lang] of Object.entries(urlLanguageHints)) {
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

export async function runConcurrentTasks<T>(
  taskGeneratorFactory: () => AsyncGenerator<() => Promise<T>, void, unknown>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const generator = taskGeneratorFactory(); // Instantiate the generator ONCE

  const workers = Array.from({ length: concurrency }, async () => {
    // Each worker pulls tasks from the SAME shared generator instance
    for await (const task of generator) {
      try {
        const result = await task();
        // Only push if the result is not null or undefined,
        // as some tasks might not return a meaningful result to collect.
        if (result !== null && result !== undefined) {
          results.push(result);
        }
      } catch (error) {
        console.error('[runConcurrentTasks] Error executing task:', error);
        // Depending on requirements, you might want to collect errors,
        // re-throw, or handle them in a specific way.
        // For now, we log and the worker continues to try to process more tasks.
      }
    }
  });

  await Promise.all(workers);
  // The original filter is useful if tasks can intentionally return null
  // and these should be excluded from the final list.
  // Given the check before push, this specifically handles tasks that might return null
  // as a valid "non-value" to be filtered.
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
