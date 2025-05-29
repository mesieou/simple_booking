import { parseLinksFromHtml } from './linkParser';
import { fetchRawHtmlContent, FetchResult } from '../fetchHtml';
import { runConcurrentTasks } from '../../utils';
import { Mutex } from 'async-mutex';
import { RobotsRules, isUrlAllowed } from '../robotsParser';

/**
 * Checks if a given URL string belongs to the same hostname as a base URL object.
 * @param url The URL string to check.
 * @param base The base URL (as a URL object) to compare against.
 * @returns True if the hostnames match, false otherwise or if the input URL is invalid.
 */
function _isSameDomain(url: string, base: URL): boolean {
  try {
    // Compare the hostname of the parsed input URL with the base URL's hostname.
    return new URL(url).hostname === base.hostname;
  } catch {
    // If new URL(url) throws (e.g., invalid URL format), it's not the same domain or not processable.
    return false;
  }
}

/** Parameters for the _fetchAndProcessPageLinks internal helper. */
interface FetchAndProcessPageLinksParams {
  pageUrl: string;
  currentDepth: number;
  siteBaseUrl: URL;
  robotsRules: RobotsRules | null;
  visitedSet: Set<string>;
  processingQueue: { url: string; depth: number }[];
  allAttemptedUrlsSet: Set<string>;
  queueManager: { accessQueue<T>(fn: () => T): Promise<T> }; // Pass the queueManager for safe queue/set access
}

/**
 * Fetches HTML for a single page, parses its links, filters them (domain, robots.txt),
 * and adds valid new links to the processing queue.
 * This is an internal helper for crawlDomainLinksBreadthFirst.
 * @param params - The parameters for fetching and processing page links.
 * @returns The processed URL if successful and content was fetched, otherwise null.
 */
async function _fetchAndProcessPageLinks({
  pageUrl,
  currentDepth,
  siteBaseUrl,
  robotsRules,
  visitedSet,
  processingQueue,
  allAttemptedUrlsSet,
  queueManager,
}: FetchAndProcessPageLinksParams): Promise<string | null> {
  try {
    // Fetch the raw HTML content for the current page URL.
    const fetchResult: FetchResult = await fetchRawHtmlContent(pageUrl);
    if (!fetchResult.success || !fetchResult.html) {
      console.warn(`[LinkCrawler] Failed to fetch HTML for ${pageUrl}: ${fetchResult.errorMessage || fetchResult.errorStatus}`);
      return null; // Return null if fetching failed or no HTML content.
    }
    const html = fetchResult.html;

    // Parse all links from the fetched HTML, resolved against the site's base URL.
    const discoveredLinksRaw = parseLinksFromHtml(html, siteBaseUrl.href);
    console.log(`[LinkCrawler Debug] From ${pageUrl} - Discovered Raw Links (${discoveredLinksRaw.length}):`, JSON.stringify(discoveredLinksRaw));
    // Record all discovered links (before filtering) as having been seen/attempted.
    discoveredLinksRaw.forEach(link => allAttemptedUrlsSet.add(link));

    // Filter the discovered links.
    const discoveredLinksFiltered = discoveredLinksRaw.filter(link => {
      // Rule 1: Ensure the link is within the same domain as the starting URL.
      if (!_isSameDomain(link, siteBaseUrl)) {
        console.log(`[LinkCrawler Debug] Filtering out (not same domain): ${link} (Base: ${siteBaseUrl.hostname})`);
        return false;
      }
      // Rule 2: Ensure the link is allowed by robots.txt rules.
      if (!isUrlAllowed(link, robotsRules, siteBaseUrl.href)) {
        console.log(`[LinkCrawler Debug] Filtering out (robots.txt or skipPatterns): ${link}`);
        // console.log(`[LinkCrawler] Link from ${pageUrl} disallowed by robots.txt: ${link}`); // Optional: verbose logging
        return false;
      }
      return true;
    });
    console.log(`[LinkCrawler Debug] From ${pageUrl} - Filtered Allowed Links (${discoveredLinksFiltered.length}):`, JSON.stringify(discoveredLinksFiltered));
    
    if (discoveredLinksFiltered.length > 0) {
      // console.log(`[LinkCrawler] Found ${discoveredLinksFiltered.length} allowed links from ${pageUrl} to enqueue.`); // Optional: verbose logging
    }

    // Add valid, new, and allowed links to the processing queue, protected by the mutex.
    await queueManager.accessQueue(() => {
      for (const link of discoveredLinksFiltered) {
        // Add to queue only if not already visited and not already in the queue.
        if (!visitedSet.has(link) && !processingQueue.some(q => q.url === link)) {
          processingQueue.push({ url: link, depth: currentDepth + 1 });
        }
      }
    });

    return pageUrl; // Return the successfully processed page URL.
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[LinkCrawler] Error processing page ${pageUrl}:`, errorMessage);
    return null; // Return null in case of any other errors during processing.
  }
}

/**
 * Performs a breadth-first crawl starting from a given URL to discover all unique, 
 * same-domain, and robots.txt-allowed links up to a specified depth and page count.
 *
 * @param startUrl The initial URL to begin crawling from.
 * @param maxPages The maximum number of pages to fetch and process.
 * @param concurrency The number of concurrent fetch/process operations.
 * @param maxDepth The maximum depth of links to follow from the start URL.
 * @param robotsRules Parsed robots.txt rules for the domain.
 * @returns A Promise resolving to an object containing all attempted absolute URLs and the set of processable domain URLs found.
 */
export async function crawlDomainLinksBreadthFirst(
  startUrl: string,
  maxPages: number = 50,
  concurrency: number = 5,
  maxDepth: number = 2,
  robotsRules: RobotsRules | null
): Promise<{ allAttemptedAbsoluteUrls: string[], processableDomainUrls: string[] }> {
  const visitedSet = new Set<string>();
  const processingQueue: { url: string, depth: number }[] = [{ url: startUrl, depth: 0 }];
  const siteBaseUrl = new URL(startUrl); // Used for same-domain checks and resolving relative links.
  const allAttemptedUrlsSet = new Set<string>();
  allAttemptedUrlsSet.add(new URL(startUrl, siteBaseUrl.href).href); // Add normalized start URL.
  
  let processedPagesCount = 0;
  const mutex = new Mutex(); // Mutex to ensure thread-safe access to shared queue and visited set.
  let activeTasksCount = 0; // Track active tasks

  // Encapsulates mutex-protected access to shared data structures.
  const queueManager = {
    async accessQueue<T>(fn: () => T): Promise<T> {
      return mutex.runExclusive(async () => fn());
    }
  };

  // Asynchronous generator function that yields tasks for processing URLs from the queue.
  function urlProcessingTaskGenerator() {
    return async function* () {
      while (processedPagesCount < maxPages) {
        let nextItemInQueue = await queueManager.accessQueue(() => processingQueue.shift());
        
        // Log current state at the beginning of each loop iteration
        const currentQueueLength = await queueManager.accessQueue(() => processingQueue.length);
        console.log(`[LinkCrawler Debug TaskGen] Loop Top. processedPagesCount: ${processedPagesCount}, activeTasksCount: ${activeTasksCount}, queue.length: ${currentQueueLength}, nextItem (after shift): ${JSON.stringify(nextItemInQueue)}`);

        if (!nextItemInQueue) {
          if (activeTasksCount > 0) {
            console.log("[LinkCrawler Debug TaskGen] Queue empty, but tasks active. Pausing generator briefly.");
            await new Promise(resolve => setTimeout(resolve, 100)); 
            continue; 
          } else {
            console.log("[LinkCrawler Debug TaskGen] Queue empty and no active tasks. Breaking from task generation loop.");
            break; 
          }
        }
        
        const { url: currentUrlToProcess, depth: currentDepth } = nextItemInQueue;
        // Normalize URL immediately after dequeuing to ensure consistent format for checks and visited set.
        const normalizedCurrentUrl = new URL(currentUrlToProcess, siteBaseUrl.href).href;
        allAttemptedUrlsSet.add(normalizedCurrentUrl); // Track all URLs we attempt to process or consider.

        // --- Pre-fetch validation checks ---
        // Rule 1: Check robots.txt before attempting to fetch.
        if (!isUrlAllowed(normalizedCurrentUrl, robotsRules, siteBaseUrl.href)) {
          console.log(`[LinkCrawler Debug] Pre-fetch validation: Skipping (disallowed by robots.txt): ${normalizedCurrentUrl}`);
          continue;
        }
        // Rule 2: Check if maximum crawl depth has been reached.
        if (currentDepth >= maxDepth) {
          console.log(`[LinkCrawler Debug] Pre-fetch validation: Skipping (maxDepth ${currentDepth} >= ${maxDepth}): ${normalizedCurrentUrl}`);
          continue;
        }
        // Rule 3: Check if this URL has already been visited.
        if (visitedSet.has(normalizedCurrentUrl)) {
          console.log(`[LinkCrawler Debug] Pre-fetch validation: Skipping (already visited): ${normalizedCurrentUrl}`);
          continue;
        }
        // Rule 4: Check if the URL is within the same domain.
        if (!_isSameDomain(normalizedCurrentUrl, siteBaseUrl)) {
          console.log(`[LinkCrawler Debug] Pre-fetch validation: Skipping (not same domain): ${normalizedCurrentUrl} (Base: ${siteBaseUrl.hostname})`);
          continue;
        }

        console.log(`[LinkCrawler Debug] Pre-fetch validation: PASSED for ${normalizedCurrentUrl} at depth ${currentDepth}`);

        // If all checks pass, mark as visited (protected by mutex) and increment processed count.
        await queueManager.accessQueue(() => visitedSet.add(normalizedCurrentUrl));
        processedPagesCount++;
        console.log(`[LinkCrawler Debug TaskGen] Yielding task for ${normalizedCurrentUrl}. processedPagesCount now: ${processedPagesCount}, activeTasksCount now: ${activeTasksCount}`);

        activeTasksCount++;
        yield async () => {
          try {
            return await _fetchAndProcessPageLinks({
                pageUrl: normalizedCurrentUrl, currentDepth, siteBaseUrl, 
                robotsRules, visitedSet, processingQueue, 
                allAttemptedUrlsSet, queueManager
            });
          } finally {
            await queueManager.accessQueue(() => activeTasksCount--);
            console.log(`[LinkCrawler Debug TaskGen] Task for ${normalizedCurrentUrl} finished. activeTasksCount now: ${activeTasksCount}`);
          }
        };
      }
      console.log("[LinkCrawler Debug TaskGen] Exited task generation loop. Final processedPagesCount:", processedPagesCount, "maxPages:", maxPages, "activeTasksCount:", activeTasksCount);
    };
  }

  console.log(`[LinkCrawler] Starting link discovery from: ${startUrl} (Max Pages: ${maxPages}, Max Depth: ${maxDepth}, Concurrency: ${concurrency})`);
  // Run all generated tasks concurrently.
  const resultsOfProcessing = await runConcurrentTasks(urlProcessingTaskGenerator(), concurrency);
  // Filter out null results (from errors or skipped tasks) to get successfully processed URLs.
  const successfullyProcessedUrls = resultsOfProcessing.filter((r): r is string => r !== null);
  
  console.log(`[LinkCrawler] Link discovery completed. Found ${successfullyProcessedUrls.length} processable domain pages by crawling. Encountered ${allAttemptedUrlsSet.size} unique URLs overall.`);
  return { 
    allAttemptedAbsoluteUrls: Array.from(allAttemptedUrlsSet),
    processableDomainUrls: successfullyProcessedUrls 
  };
}