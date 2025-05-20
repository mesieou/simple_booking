import { parseLinksFromHtml } from './linkParser';
import { fetchRootPage } from './fetchRootPage';
import { fetchHtml } from './fetchHtml';
import { detectLanguage, runConcurrentTasks } from '../utils';

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
  const inlinkCount: Record<string, number> = {};
  let processedCount = 0;

  function* makeQueueIterator(queue: { url: string, depth: number }[]) {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next) yield next;
    }
  }

  const queueIterator = makeQueueIterator(queue);

  async function safeNext(): Promise<{ url: string, depth: number } | undefined> {
    const entry = queueIterator.next();
    if (!entry.done) return entry.value;
    return undefined;
  }

  async function* taskGenerator() {
    while (true) {
      const next = await safeNext();
      if (!next) return;
      const { url, depth } = next;
      const normUrl = new URL(url).href;
      if (visited.has(normUrl)) continue;
      visited.add(normUrl);
      processedCount++;
      try {
        const html = await fetchHtml(normUrl);
        if (html) {
          if (mainLanguage) {
            const detectedLang = detectLanguage(normUrl, html);
            if (detectedLang !== mainLanguage) {
              continue;
            }
          }
          if (depth >= maxDepth) {
            continue;
          }
          const links = parseLinksFromHtml(html, base.href);
          for (const link of links) {
            if (!visited.has(link) && !queue.some(q => q.url === link)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } catch (error) {
        console.error(`[Concurrent Crawler] error processing ${normUrl}:`, error);
      }
    }
  }

  await runConcurrentTasks(taskGenerator, concurrency);
  return Array.from(visited);
} 