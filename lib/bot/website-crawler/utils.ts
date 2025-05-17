import crypto from 'crypto';
import { CrawlState } from './types';

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

export function detectLanguage(url: string, content: string): string {
  // Check URL patterns first
  const urlLang = url.match(/-([a-z]{2})(?:$|[/?])/i)?.[1]?.toLowerCase();
  if (urlLang) return urlLang;

  // Check content language hints
  const langMatch = content.match(/lang=["']([a-z]{2})["']/i);
  if (langMatch) return langMatch[1].toLowerCase();

  // Simple English detection based on common words
  const englishWords = ['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but'];
  const words = content.toLowerCase().split(/\s+/);
  const englishWordCount = words.filter(word => englishWords.includes(word)).length;
  
  // If more than 5% of words are common English words, consider it English
  if (englishWordCount / words.length > 0.05) {
    return 'en';
  }

  // Default to non-English if we can't confidently determine
  return 'unknown';
}

export async function delay(state: CrawlState): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - state.lastRequestTime;
  if (timeSinceLastRequest < state.config.requestDelay!) {
    await new Promise(resolve => setTimeout(resolve, state.config.requestDelay! - timeSinceLastRequest));
  }
  state.lastRequestTime = Date.now();
}

/**
 * Splits text into sentences using a regex. Handles basic English punctuation.
 */
export function splitIntoSentences(text: string): string[] {
  // This regex splits on period, exclamation, or question mark followed by space or end of string
  return text.match(/[^.!?\n]+[.!?]+(\s|$)|[^.!?\n]+$/g)?.map(s => s.trim()).filter(Boolean) || [];
}

export const PRICE_REGEX = /[$€£]\d+[\d,.]*/;
