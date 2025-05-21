import { parseLinksFromHtml } from './linkParser';
import { fetchRootPage } from '../fetchRootPage';
import { fetchHtml } from '../fetchHtml';
import { detectLanguage, runConcurrentTasks } from '../../utils';

// Utility to check if URLs belong to the same domain
function isSameDomain(url: string, base: URL): boolean {
  try {
    return new URL(url).hostname === base.hostname;
  } catch {
    return false;
  }
}

export async function fetchLinksRecursively(url: string, maxDepth: number, currentDepth: number = 0): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];

  const html = await fetchRootPage(url);
  if (!html) return [];

  const links = parseLinksFromHtml(html, url);
  const allLinks = new Set(links);

  for (const link of links) {
    const nestedLinks = await fetchLinksRecursively(link, maxDepth, currentDepth + 1);
    nestedLinks.forEach(l => allLinks.add(l));
  }

  return Array.from(allLinks);
}

// Function for concurrent, breadth-first crawling
export async function getAllDomainLinksRecursive(
  startUrl: string,
  maxPages: number = 50,
  concurrency: number = 5,
  mainLanguage?: string,
  maxDepth: number = 2,
  skipProductPages: boolean = true,
  skipBlogPages: boolean = true
): Promise<string[]> {
  const visited = new Set<string>();
  const queue: { url: string, depth: number }[] = [{ url: startUrl, depth: 0 }];
  const base = new URL(startUrl);
  let processedCount = 0;

  // Mutex-like mechanism for safe queue and visited access
  const queueManager = {
    async accessQueue<T>(fn: () => T): Promise<T> {
      return fn(); // Use async-mutex in production for thread safety
    }
  };

  function urlProcessingTaskGenerator() {
    return async function* () {
      while (processedCount < maxPages) {
        const next = await queueManager.accessQueue(() => queue.shift());
        if (!next) break;
        const { url, depth } = next;
        const normUrl = new URL(url).href;

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
            const html = await fetchHtml(normUrl);
            if (!html) return null;

            if (mainLanguage && detectLanguage(normUrl, html) !== mainLanguage) {
              return null;
            }

            const links = parseLinksFromHtml(html, base.href).filter(link => {
              if (!isSameDomain(link, base)) return false;
              return true;
            });
            if (links.length > 0) {
              console.log(`[Crawler] Found and enqueuing ${links.length} links from ${normUrl}`);
            }

            await queueManager.accessQueue(() => {
              for (const link of links) {
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
  filteredResults.forEach(link => {
    console.log(`[Crawler] Added to crawl list: ${link}`);
  });
  console.log(`[Crawler] Link extraction completed. Found ${filteredResults.length} links.`);
  return filteredResults;
}