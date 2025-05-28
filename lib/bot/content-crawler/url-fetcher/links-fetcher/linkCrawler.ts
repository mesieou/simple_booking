import { parseLinksFromHtml } from './linkParser';
// import { fetchRootPage } from '../fetchRootPage'; // No longer needed if fetchLinksRecursively is removed
import { fetchRawHtmlContent } from '../fetchHtml';
import { detectLanguage, runConcurrentTasks } from '../../utils';
import { Mutex } from 'async-mutex';
import { RobotsRules, isUrlAllowed } from '../robotsParser';

// Utility to check if URLs belong to the same domain
function isSameDomain(url: string, base: URL): boolean {
  try {
    return new URL(url).hostname === base.hostname;
  } catch {
    return false;
  }
}

// Removed unused fetchLinksRecursively function
// export async function fetchLinksRecursively(...) { ... }

// Function for concurrent, breadth-first crawling
export async function getAllDomainLinksRecursive(
  startUrl: string,
  maxPages: number = 50,
  concurrency: number = 5,
  maxDepth: number = 2,
  robotsRules: RobotsRules | null
): Promise<{ allAttemptedAbsoluteUrls: string[], processableDomainUrls: string[] }> {
  const visited = new Set<string>();
  const queue: { url: string, depth: number }[] = [{ url: startUrl, depth: 0 }];
  const base = new URL(startUrl);
  const allAttemptedOrConsideredUrls = new Set<string>();
  allAttemptedOrConsideredUrls.add(new URL(startUrl, base.href).href);
  let processedCount = 0;
  const mutex = new Mutex();

  // Mutex-like mechanism for safe queue and visited access
  const queueManager = {
    async accessQueue<T>(fn: () => T): Promise<T> {
      // Using mutex.runExclusive to ensure fn() is executed exclusively.
      return mutex.runExclusive(async () => fn());
    }
  };

  function urlProcessingTaskGenerator() {
    return async function* () {
      while (processedCount < maxPages) {
        const next = await queueManager.accessQueue(() => queue.shift());
        if (!next) break;
        const { url, depth } = next;
        const normUrl = new URL(url).href;

        allAttemptedOrConsideredUrls.add(normUrl);

        // Check robots.txt for the URL we are about to process (normUrl)
        // This is important if the startUrl itself or URLs added from sitemap (if not pre-filtered by sitemap parser) are disallowed.
        if (!isUrlAllowed(normUrl, robotsRules, base.href)) {
          console.log(`[Crawler] Skipped (disallowed by robots.txt): ${normUrl}`);
          yield () => Promise.resolve(null);
          continue;
        }

        if (depth >= maxDepth) {
          console.log(`[Crawler] Skipped (maxDepth): ${normUrl}`);
          yield () => Promise.resolve(null);
          continue;
        }
        if (visited.has(normUrl)) {
          console.log(`[Crawler] Skipped (already visited): ${normUrl}`);
          yield () => Promise.resolve(null);
          continue;
        }
        if (!isSameDomain(normUrl, base)) {
          console.log(`[Crawler] Skipped (not same domain): ${normUrl}`);
          yield () => Promise.resolve(null);
          continue;
        }

        await queueManager.accessQueue(() => visited.add(normUrl));
        processedCount++;

        yield async () => {
          try {
            const fetchResult = await fetchRawHtmlContent(normUrl);
            if (!fetchResult.success || !fetchResult.html) {
              console.warn(`[LinkCrawler] Failed to fetch HTML for ${normUrl}: ${fetchResult.errorMessage || fetchResult.errorStatus}`);
              return null;
            }
            const html = fetchResult.html;

            let discoveredLinksRaw = parseLinksFromHtml(html, base.href);
            discoveredLinksRaw.forEach(link => allAttemptedOrConsideredUrls.add(link));

            let discoveredLinksFiltered = discoveredLinksRaw.filter(link => {
              if (!isSameDomain(link, base)) return false;
              // Further filter by robots.txt before adding to queue
              if (!isUrlAllowed(link, robotsRules, base.href)) {
                console.log(`[Crawler] Link from page ${normUrl} disallowed by robots.txt: ${link}`);
                return false;
              }
              return true;
            });
            
            if (discoveredLinksFiltered.length > 0) {
              console.log(`[Crawler] Found and enqueuing ${discoveredLinksFiltered.length} allowed links from ${normUrl}`);
            }

            await queueManager.accessQueue(() => {
              for (const link of discoveredLinksFiltered) {
                if (!visited.has(link) && !queue.some(q => q.url === link)) {
                  queue.push({ url: link, depth: depth + 1 });
                }
              }
            });

            return normUrl;
          } catch (error) {
            console.error(`[Concurrent Crawler] error processing ${normUrl}:`, error);
            return null;
          }
        };
      }
    };
  }

  console.log(`[Crawler] Starting link extraction from: ${startUrl}`);
  const results = await runConcurrentTasks(urlProcessingTaskGenerator(), concurrency);
  const filteredResults = results.filter((r): r is string => r !== null);
  console.log(`[Crawler] Link extraction completed. Found ${filteredResults.length} processable domain links. Encountered ${allAttemptedOrConsideredUrls.size} unique URLs in total.`);
  return { 
    allAttemptedAbsoluteUrls: Array.from(allAttemptedOrConsideredUrls),
    processableDomainUrls: filteredResults 
  };
}