import crypto from 'crypto';
import {
  CrawlConfig,
  CrawlResult,
  defaultConfig,
  ExtractedPatterns,
} from '@/lib/config/config';
import { RobotsRules, isUrlAllowed } from './robotsParser';
import { processSingleUrlAndSaveArtifacts, ProcessedUrlResult } from './SingleUrlProcessor';
import { updateCrawlResults } from './resultManager';
import { logger as globalLoggerInstance } from '../process-content/logger';
import { runConcurrentTasks } from '../utils';

/** Parameters for the _processAndRecordUrl internal helper function. */
interface ProcessAndRecordUrlParams {
  fullUrl: string;
  websiteUrl: string; // Needed for context, e.g. if robots.txt check needs re-validation or relative pathing
  config: CrawlConfig;
  mainLanguage: string;
  domain: string;
  crawlResults: CrawlResult[]; 
  processedContentSignatures: Set<string>; 
}

/**
 * Processes a single URL: fetches content, cleans it, checks for duplicates, and records the result.
 * This is an internal helper function for `processUrlsConcurrently`.
 * @param params - The parameters for processing and recording the URL.
 */
async function _processAndRecordUrl({
  fullUrl,
  // websiteUrl, // Not directly used in the core logic here, but kept if future versions need it for deeper checks
  config,
  mainLanguage,
  domain,
  crawlResults,
  processedContentSignatures,
}: ProcessAndRecordUrlParams): Promise<void> {
  // Fetch and process the content of the single URL.
  const singleUrlProcessingOutcome: ProcessedUrlResult = await processSingleUrlAndSaveArtifacts(
    fullUrl,
    config
  );

  // Handle successful processing: content extracted and URL is valid.
  if (singleUrlProcessingOutcome.status === 'success' && singleUrlProcessingOutcome.cleanedText && singleUrlProcessingOutcome.finalUrl) {
    const { cleanedText, finalUrl, pageTitle, language, extractedPatterns } = singleUrlProcessingOutcome;
    
    // Generate a signature for the cleaned text to detect duplicates.
    const currentContentSignature = crypto
      .createHash('sha256')
      .update(cleanedText)
      .digest('hex');

    const determinedLanguage = language || mainLanguage;

    // Check if this content signature has been seen before.
    if (processedContentSignatures.has(currentContentSignature)) {
      const reason = `duplicate content (signature: ${currentContentSignature.substring(0, 12)}...)`;
      await globalLoggerInstance.logUrlSkipped(finalUrl, reason);
      updateCrawlResults(
        crawlResults, domain, cleanedText, determinedLanguage, reason, finalUrl,
        extractedPatterns as ExtractedPatterns | null, pageTitle ?? null
      );
    } else {
      // New unique content found.
      processedContentSignatures.add(currentContentSignature);
      await globalLoggerInstance.logUrlProcessed(finalUrl);
      updateCrawlResults(
        crawlResults, domain, cleanedText, determinedLanguage, 'ok', finalUrl,
        extractedPatterns as ExtractedPatterns | null, pageTitle ?? null
      );
    }
  } else {
    // Handle failed processing: error occurred, or no content extracted.
    const { errorMessage, pageTitle, cleanedText, language, finalUrl, extractedPatterns } = singleUrlProcessingOutcome;
    const reason = errorMessage || 'Unknown processing error';
    const anErrorOccurredFinalUrl = finalUrl || fullUrl; // Use original fullUrl if finalUrl isn't available after error.
    const determinedLanguage = language || mainLanguage;

    // Log the failure and update crawl results with the error information.
    await globalLoggerInstance.logUrlFailed(anErrorOccurredFinalUrl, reason);
    updateCrawlResults(
      crawlResults, domain, cleanedText ?? null, determinedLanguage, reason, anErrorOccurredFinalUrl,
      extractedPatterns as ExtractedPatterns | null, pageTitle ?? null
    );
  }

  // Apply a configured delay after processing each URL, if specified.
  if (config.requestDelay && config.requestDelay > 0) {
    await new Promise(res => setTimeout(res, config.requestDelay!));
  }
}

/** Parameters for the processUrlsConcurrently function. */
interface ProcessUrlsConcurrentlyParams {
  urlsToProcess: string[];
  websiteUrl: string;
  robotsRules: RobotsRules | null;
  config: CrawlConfig;
  crawlResults: CrawlResult[]; // Mutable, for updating with results from each processed URL.
  processedUrlTasks: Set<string>; // Mutable, for tracking URLs that have been queued or initiated.
  processedContentSignatures: Set<string>; // Mutable, for tracking content signatures to detect duplicates.
  mainLanguage: string;
  domain: string;
}

/**
 * Processes a list of URLs concurrently, respecting robots.txt, handling duplicates, and managing errors.
 * @param params - The parameters for concurrent URL processing.
 */
export async function processUrlsConcurrently({
  urlsToProcess,
  websiteUrl,
  robotsRules,
  config,
  crawlResults,
  processedUrlTasks,
  processedContentSignatures,
  mainLanguage,
  domain,
}: ProcessUrlsConcurrentlyParams): Promise<void> {
  // Determine the number of concurrent tasks to run, defaulting if not specified in config.
  const concurrency = config.concurrency ?? defaultConfig.concurrency;

  // Asynchronous generator function that yields tasks for processing individual URLs.
  async function* urlProcessingTaskGenerator() {
    for (const currentUrlToProcess of urlsToProcess) {
      let fullUrl: string;
      try {
        // Attempt to construct a full, valid URL from the input string.
        fullUrl = new URL(currentUrlToProcess, websiteUrl).toString();
      } catch (e) {
        // If URL construction fails, log it as skipped and update results.
        const invalidUrlMessage = e instanceof Error ? e.message : 'Invalid URL structure';
        await globalLoggerInstance.logUrlSkipped(currentUrlToProcess, invalidUrlMessage);
        updateCrawlResults(crawlResults, domain, null, 'unknown', invalidUrlMessage, currentUrlToProcess);
        continue; // Move to the next URL in the list.
      }

      // Skip this URL if it has already been added to the processing queue (task initiated).
      if (processedUrlTasks.has(fullUrl)) {
        continue;
      }
      processedUrlTasks.add(fullUrl); // Mark this URL as having a task initiated for it.

      // Check if the URL is allowed by the site's robots.txt rules.
      if (!isUrlAllowed(fullUrl, robotsRules, websiteUrl)) {
        await globalLoggerInstance.logUrlSkipped(fullUrl, 'disallowed by robots.txt');
        updateCrawlResults(crawlResults, domain, null, 'unknown', 'disallowed by robots.txt', fullUrl);
        continue; // Move to the next URL if disallowed.
      }

      // Yield an asynchronous task to process and record this validated and allowed URL.
      yield async () => _processAndRecordUrl({
        fullUrl,
        websiteUrl, // Pass websiteUrl for context, though _processAndRecordUrl might not use it directly now
        config,
        mainLanguage,
        domain,
        crawlResults,
        processedContentSignatures,
      });
    }
  }

  // Run the generated URL processing tasks concurrently up to the specified limit.
  await runConcurrentTasks(() => urlProcessingTaskGenerator(), concurrency);
} 