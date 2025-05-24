import { cleanAndExtractMainContent } from './htmlCleaner';
import { filterAndSaveContent } from './contentFilter';
import { detectLanguage } from '../utils';

/**
 * Fetches a page, cleans its HTML, detects language, and optionally saves the content
 */
export async function fetchCleanAndDetectLanguageFromPage(
  url: string,
  index?: number,
  saveToFile: boolean = false
): Promise<{ html: string | null; language: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Page Processor] Failed to fetch ${url}: ${response.status}`);
      return { html: null, language: 'unknown' };
    }

    const html = await response.text();
    const cleanedHtml = cleanAndExtractMainContent(html);
    const language = detectLanguage(url, cleanedHtml);

    if (saveToFile && index !== undefined) {
      await filterAndSaveContent(cleanedHtml, url, index);
    }

    return { html: cleanedHtml, language };
  } catch (error) {
    console.error(`[Page Processor] Error processing ${url}:`, error);
    return { html: null, language: 'unknown' };
  }
} 