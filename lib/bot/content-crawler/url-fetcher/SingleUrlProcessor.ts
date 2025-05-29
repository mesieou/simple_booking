import { CrawlConfig, ExtractedPatterns } from '@/lib/config/config';
import { logger as globalLoggerInstance } from '@/lib/bot/content-crawler/process-content/logger'; // Use the global logger instance
import { 
    saveRawHtml, 
    saveCleanedTextForUrl, 
    getUrlIdentifier 
} from '@/lib/bot/content-crawler/process-content/logger-artifact-savers';
import { fetchRawHtmlContent, FetchResult } from './fetchHtml';
import { cleanAndExtractMainContent, SimplifiedCleanedContentResult } from './htmlCleaner';
// import { isValidLink } from './validateUrl'; // May not be used directly if baseUrl is not available here
import { isLowValueContent } from '../html-utils';
import { detectLanguage } from '../utils';
import * as cheerio from 'cheerio';

/** Represents the outcome of processing a single URL. */
export interface ProcessedUrlResult {
  rawHtml?: string;
  cleanedText?: string;
  language?: string;
  status: 'success' | 'fetch_failed' | 'invalid_url_format' | 'low_value' | 'empty_content' | 'skipped_by_config';
  errorMessage?: string;
  extractedPatterns?: ExtractedPatterns;
  pageTitle?: string;
  finalUrl?: string; // The URL after any redirects
}

/** 
 * Internal result structure for the initial validation and fetching step. 
 */
interface ValidatedAndFetchedHtml {
    isValid: boolean;
    fetchResult?: FetchResult;
    errorMessage?: string; // Specifically for URL validation error
}

/**
 * Validates the basic structure of a URL and then attempts to fetch its raw HTML content.
 * @param url The URL string to validate and fetch.
 * @returns An object indicating if validation and fetching were successful, along with fetched data or error messages.
 */
async function _validateAndFetchInitialHtml(url: string): Promise<ValidatedAndFetchedHtml> {
    // Step 1: Validate basic URL structure.
    try {
        new URL(url); // Throws if URL is malformed.
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Invalid URL structure';
        await globalLoggerInstance.logUrlSkipped(url, message);
        return { isValid: false, errorMessage: message };
    }

    // Step 2: Fetch raw HTML content.
    const fetchResult = await fetchRawHtmlContent(url);
    return { isValid: true, fetchResult };
}

/** 
 * Internal result structure for text content extraction and analysis. 
 */
interface AnalyzedTextContent {
    pageTitle?: string;
    cleanedText: string;
    extractedPatterns: ExtractedPatterns;
    language?: string;
    isEmpty: boolean;
    isLowValue: boolean;
    lowValueReason?: string;
}

/**
 * Extracts title, cleans HTML to text, checks for low value, and detects language.
 * @param html The raw HTML content string.
 * @param urlForContext The effective URL (after redirects) used for context in checks like isLowValueContent.
 * @param config The crawl configuration, used for language detection hints.
 * @returns An object containing the extracted and analyzed text content information.
 */
function _extractAndAnalyzeTextContent(
    html: string,
    urlForContext: string,
    config: CrawlConfig
): AnalyzedTextContent {
    let pageTitle: string | undefined;
    // Step 1: Extract page title using Cheerio.
    try {
        const $ = cheerio.load(html);
        pageTitle = $('head > title').text().trim() || undefined;
    } catch (e) {
        console.warn(`[SingleUrlProcessor] Error extracting title for ${urlForContext}:`, e instanceof Error ? e.message : String(e));
    }

    // Step 2: Clean HTML and extract main textual content and other patterns.
    const { allExtractedText: cleanedText, extractedPatterns }: SimplifiedCleanedContentResult = cleanAndExtractMainContent(html);

    // Step 3: Check if cleaning resulted in empty content.
    if (!cleanedText || cleanedText.trim().length === 0) {
        return { pageTitle, cleanedText: cleanedText || '', extractedPatterns, isEmpty: true, isLowValue: false };
    }

    // Step 4: Check if the extracted content is of low informational value.
    const lowValueReason = isLowValueContent(cleanedText, urlForContext);
    if (lowValueReason) {
        return { pageTitle, cleanedText, extractedPatterns, isEmpty: false, isLowValue: true, lowValueReason };
    }

    // Step 5: Detect language of the cleaned text.
    const langDetectionOptions = {
        importantUrls: config.importantUrlsForDetection,
        urlLanguageHints: config.urlLanguageHintsForDetection,
        // defaultLanguage: 'en' // Consider making this a global config if needed
    };
    const language = detectLanguage(urlForContext, cleanedText, langDetectionOptions);

    return { pageTitle, cleanedText, extractedPatterns, language, isEmpty: false, isLowValue: false };
}

/**
 * Processes a single URL: validates, fetches, cleans, analyzes content, saves artifacts, and determines its status.
 * @param url The URL string to process.
 * @param config The crawl configuration.
 * @returns A promise that resolves to a ProcessedUrlResult object detailing the outcome.
 */
export const processSingleUrlAndSaveArtifacts = async (
  url: string,
  config: CrawlConfig,
): Promise<ProcessedUrlResult> => {
  // Stage 1: Validate URL structure and fetch raw HTML content.
  const validationAndFetchOutcome = await _validateAndFetchInitialHtml(url);

  if (!validationAndFetchOutcome.isValid) {
    return { status: 'invalid_url_format', errorMessage: validationAndFetchOutcome.errorMessage || 'Invalid URL format' };
  }

  const { fetchResult } = validationAndFetchOutcome;
  // Determine the effective URL to use, considering potential redirects from fetching.
  const effectiveUrl = fetchResult!.finalUrl || url;

  if (!fetchResult!.success || !fetchResult!.html) {
    const errorMessage = `Fetch failed: ${fetchResult!.errorStatus || fetchResult!.errorMessage}`;
    await globalLoggerInstance.logUrlSkipped(effectiveUrl, errorMessage);
    return { status: 'fetch_failed', finalUrl: effectiveUrl, errorMessage };
  }
  
  const rawHtml = fetchResult!.html;
  // Save the fetched raw HTML content to artifacts.
  await saveRawHtml(effectiveUrl, rawHtml);

  // Stage 2: Extract title, clean content, check value, and detect language.
  const analyzedContent = _extractAndAnalyzeTextContent(rawHtml, effectiveUrl, config);
  const { pageTitle, cleanedText, extractedPatterns, language, isEmpty, isLowValue, lowValueReason } = analyzedContent;

  // Handle case: Cleaning resulted in empty content.
  if (isEmpty) {
    await globalLoggerInstance.logUrlSkipped(effectiveUrl, 'Cleaning resulted in empty content');
    await saveCleanedTextForUrl(effectiveUrl, cleanedText); // Save the (empty) cleaned text artifact.
    return {
      status: 'empty_content', rawHtml, pageTitle, extractedPatterns, finalUrl: effectiveUrl,
      cleanedText, // Ensure cleanedText (even if empty) is included for consistency
      errorMessage: 'Cleaning resulted in empty content'
    };
  }
  
  // Save the non-empty cleaned text content to artifacts *before* low-value check for completeness of artifacts.
  await saveCleanedTextForUrl(effectiveUrl, cleanedText);

  // Handle case: Content was determined to be of low value.
  if (isLowValue) {
    const reason = `Low value content: ${lowValueReason}`;
    await globalLoggerInstance.logUrlSkipped(effectiveUrl, reason);
    return { 
        status: 'low_value', rawHtml, cleanedText, pageTitle, extractedPatterns, 
        finalUrl: effectiveUrl, errorMessage: reason 
    };
  }

  // Stage 3: Successful processing with valuable content.
  return {
    rawHtml, cleanedText, language, status: 'success',
    pageTitle, extractedPatterns, finalUrl: effectiveUrl,
  };
}; 