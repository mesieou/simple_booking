import { cleanAndExtractMainContent } from './htmlCleaner';
// import { filterAndSaveContent } from './contentFilter'; // Removed as it's unused
import { detectLanguage } from '../utils';

/**
 * Fetches a page, cleans its HTML, and detects language.
 */
export async function fetchCleanAndDetectLanguageFromPage(
  url: string
): Promise<{ html: string | null; language: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Page Processor] Failed to fetch ${url}: ${response.status}`);
      return { html: null, language: 'unknown' };
    }

    const htmlContent = await response.text(); // Renamed to avoid conflict with return object property
    const cleanedHtml = cleanAndExtractMainContent(htmlContent);
    const language = detectLanguage(url, cleanedHtml);

    // Removed unused saveToFile logic and filterAndSaveContent call

    return { html: cleanedHtml, language };
  } catch (error) {
    console.error(`[Page Processor] Error processing ${url}:`, error);
    return { html: null, language: 'unknown' };
  }
} 