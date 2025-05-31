import { URL_VALIDATION_CONFIG } from '@/lib/general-config/general-config';
// import cheerio from 'cheerio'; // Removed as extractNavAndFooterLinks was deleted

/**
 * Heuristic filter for low-value, empty, or boilerplate content.
 * Returns a string reason if the content is low value, or false if it is not.
 */
export function isLowValueContent(text: string, url?: string): string | false {
  // First, check if it's a legal/utility page we want to exclude outright.
  if (url && isLegalOrUtilityPageUrl(url)) {
    return 'legal or utility page';
  }

  // Check against SKIPPED_PATTERNS from config
  if (url) {
    for (const pattern of URL_VALIDATION_CONFIG.SKIPPED_PATTERNS) {
      if (pattern.test(url)) {
        return 'skipped pattern';
      }
    }
  }

  // Next, check for explicit boilerplate or very short content, which applies to all pages.
  const trimmed = text.trim();
  if (/(coming soon|under construction|lorem ipsum)/i.test(trimmed)) {
    return 'boilerplate phrase';
  }
  if (trimmed.length < 100) { // Assuming 100 is a reasonable minimum length.
    return 'too short';
  }

  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.length < 50) { // Assuming 50 words is a reasonable minimum.
    return 'too few words';
  }

  const sentenceCount = (trimmed.match(/[.!?]/g) || []).length;
  if (sentenceCount < 2 && words.length > 30) { // Requiring at least 2 sentences for content over 30 words.
    return 'too few sentences';
  }

  // Now, the unique words check, which has an exception for core content pages.
  const uniqueWords = new Set(words);
  const isCorePage = url ? isLikelyCoreContentPageUrl(url) : false;

  if (!isCorePage && uniqueWords.size / words.length > 0.7 && words.length > 30) {
    return 'too many unique words';
  }

  return false; // If none of the above, it's not considered low value.
}

/**
 * Returns true if the URL path is likely to be a high-value business page FOR CORE CONTENT.
 */
export function isLikelyCoreContentPageUrl(url: string): boolean {
  return /about|contact|services|pricing|faq|book|appointment|quote|support|team|locations|get-in-touch|our-story|schedule|how-it-works|request|estimate|consult|demo/i.test(url);
}

/**
 * Returns true if the URL path is likely to be a legal or utility page.
 */
export function isLegalOrUtilityPageUrl(url: string): boolean {
  return /terms|privacy|legal|disclaimer|cookie|policy|acceptable-use|terms-of-service/i.test(url);
} 