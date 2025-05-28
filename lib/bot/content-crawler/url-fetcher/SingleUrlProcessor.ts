import { CrawlConfig } from '@/lib/config/config';
import { logger as globalLoggerInstance } from '@/lib/bot/content-crawler/process-content/logger'; // Use the global logger instance
import { 
    saveRawHtml, 
    saveCleanedTextForUrl, 
    getUrlIdentifier 
} from '@/lib/bot/content-crawler/process-content/logger-artifact-savers';
import { fetchRawHtmlContent } from './fetchHtml';
import { cleanAndExtractMainContent } from './htmlCleaner';
// import { isValidLink } from './validateUrl'; // May not be used directly if baseUrl is not available here
import { isLowValueContent, detectLanguage } from '../utils';
import * as cheerio from 'cheerio';

export interface ProcessedUrlResult {
  rawHtml?: string;
  cleanedText?: string;
  language?: string;
  status: 'success' | 'fetch_failed' | 'invalid_url_format' | 'low_value' | 'empty_content' | 'skipped_by_config';
  errorMessage?: string;
  extractedPatterns?: any; // From htmlCleaner
  pageTitle?: string;
  finalUrl?: string; // The URL after any redirects
}

export const processSingleUrlAndSaveArtifacts = async (
  url: string,
  config: CrawlConfig,
  // baseOutputPath is no longer needed here as savers use internal logsRootPathInternal
): Promise<ProcessedUrlResult> => {
  try {
    new URL(url);
  } catch (e) {
    await globalLoggerInstance.logUrlSkipped(url, 'Invalid URL format');
    return { status: 'invalid_url_format', errorMessage: 'Invalid URL format' };
  }

  // Potentially add checks from config.urlValidationConfig here if needed, e.g., skipped extensions
  // For now, relying on initial filtering in crawlManager and robots.txt

  const fetchResult = await fetchRawHtmlContent(url);
  // Use final URL after redirects for logging and as the primary identifier for artifacts
  const currentUrlForArtifactsAndLogs = fetchResult.finalUrl || url; 

  if (!fetchResult.success || !fetchResult.html) {
    await globalLoggerInstance.logUrlSkipped(currentUrlForArtifactsAndLogs, `Fetch failed: ${fetchResult.errorStatus || fetchResult.errorMessage}`);
    return { 
        status: 'fetch_failed', 
        finalUrl: currentUrlForArtifactsAndLogs, 
        errorMessage: `Fetch failed: ${fetchResult.errorStatus || fetchResult.errorMessage}` 
    };
  }
  
  // saveRawHtml and saveCleanedTextForUrl internally derive path from logsRootPathInternal and the URL.
  await saveRawHtml(currentUrlForArtifactsAndLogs, fetchResult.html); 

  let pageTitle: string | undefined;
  try {
    const $ = cheerio.load(fetchResult.html);
    pageTitle = $('head > title').text().trim() || undefined;
  } catch (e) {
    console.warn(`[SingleUrlProcessor] Error extracting title for ${currentUrlForArtifactsAndLogs}:`, e instanceof Error ? e.message : String(e));
  }

  const { allExtractedText: cleanedText, extractedPatterns } = cleanAndExtractMainContent(fetchResult.html);

  if (!cleanedText || cleanedText.trim().length === 0) {
    await globalLoggerInstance.logUrlSkipped(currentUrlForArtifactsAndLogs, 'Cleaning resulted in empty content');
    await saveCleanedTextForUrl(currentUrlForArtifactsAndLogs, cleanedText || ''); 
    return { 
      status: 'empty_content', 
      rawHtml: fetchResult.html, 
      pageTitle, 
      extractedPatterns, 
      finalUrl: currentUrlForArtifactsAndLogs, 
      errorMessage: 'Cleaning resulted in empty content' 
    };
  }
  
  await saveCleanedTextForUrl(currentUrlForArtifactsAndLogs, cleanedText);

  const lowValueReason = isLowValueContent(cleanedText, currentUrlForArtifactsAndLogs);
  if (lowValueReason) {
    await globalLoggerInstance.logUrlSkipped(currentUrlForArtifactsAndLogs, `Low value content: ${lowValueReason}`);
    return { 
      status: 'low_value', 
      rawHtml: fetchResult.html, 
      cleanedText, 
      pageTitle, 
      extractedPatterns, 
      finalUrl: currentUrlForArtifactsAndLogs, 
      errorMessage: `Low value content: ${lowValueReason}` 
    };
  }

  const langDetectionOptions = {
    importantUrls: config.importantUrlsForDetection,
    urlLanguageHints: config.urlLanguageHintsForDetection,
    defaultLanguage: 'en' // Or make this configurable too if needed
  };
  const language = detectLanguage(currentUrlForArtifactsAndLogs, cleanedText, langDetectionOptions);

  return {
    rawHtml: fetchResult.html,
    cleanedText,
    language,
    status: 'success',
    pageTitle,
    extractedPatterns,
    finalUrl: currentUrlForArtifactsAndLogs,
  };
}; 