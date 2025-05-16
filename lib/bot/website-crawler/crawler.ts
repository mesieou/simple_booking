import { CrawlSession } from '@/lib/models/crawl-session';
import { CrawlState, FastCrawlConfig, PageContent, CrawlProgress } from './types';
import { DEFAULT_HEADERS } from './constants';
import { delay } from './utils';
import { processHtmlContent, processPdfContent } from './content-processor';
import { createEmbeddings } from './embeddings';
import parseRobots from 'robots-parser';
import pLimit from 'p-limit';
import { handleModelError } from '@/lib/helpers/error';
export function createInitialState(config: FastCrawlConfig): CrawlState {
  return {
    visitedUrls: new Set<string>(),
    contentHashes: new Set<string>(),
    config: {
      maxPages: 100,
      requestDelay: 100,
      maxRetries: 3,
      concurrency: 20,
      useSitemap: true,
      logInterval: {
        urls: 10,
        seconds: 5
      },
      ...config
    },
    baseUrl: new URL(config.websiteUrl),
    robotsRules: null,
    lastRequestTime: 0,
    crawlSession: new CrawlSession({
      businessId: config.businessId,
      startTime: Date.now(),
      totalPages: 0,
      successfulPages: 0,
      failedPages: 0,
      categories: {},
      errors: []
    }),
    activePages: 0,
    lastLogTime: Date.now(),
    lastLogUrlCount: 0
  };
}

async function validateAndCheckRobots(state: CrawlState): Promise<boolean> {
  try {
    const robotsUrl = `${state.baseUrl.origin}/robots.txt`;
    const response = await fetch(robotsUrl, { 
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch robots.txt: ${response.status}`);
    }
    
    const text = await response.text();
    state.robotsRules = parseRobots(robotsUrl, text);
    return state.robotsRules.isAllowed(state.config.websiteUrl, DEFAULT_HEADERS['User-Agent']);
  } catch (error) {
    console.warn('Could not fetch robots.txt, proceeding with crawl:', error);
    return true;
  }
}

async function getInitialUrls(state: CrawlState): Promise<string[]> {
  return [state.config.websiteUrl];
}

function logProgress(state: CrawlState, currentUrl: string, progressCallback?: (progress: CrawlProgress) => void): void {
  const now = Date.now();
  const urlCount = state.visitedUrls.size;
  const shouldLog = 
    (state.config.logInterval?.urls && (urlCount - state.lastLogUrlCount) >= state.config.logInterval.urls) ||
    (state.config.logInterval?.seconds && (now - state.lastLogTime) >= (state.config.logInterval.seconds * 1000));

  if (shouldLog) {
    const elapsedSeconds = Math.floor((now - state.crawlSession.startTime) / 1000);
    const urlsPerSecond = (urlCount / elapsedSeconds).toFixed(2);
    const progress = (urlCount / state.config.maxPages! * 100).toFixed(1);
    
    console.log(`[${new Date().toISOString()}] Progress: ${progress}% (${urlCount}/${state.config.maxPages})`);
    console.log(`  Current URL: ${currentUrl}`);
    console.log(`  Speed: ${urlsPerSecond} URLs/sec`);
    console.log(`  Success: ${state.crawlSession.successfulPages}, Failed: ${state.crawlSession.failedPages}`);
    console.log(`  Active pages: ${state.activePages}`);
    
    // Enhanced category logging
    const categoryStats = Object.entries(state.crawlSession.categories)
      .sort(([, a], [, b]) => (b as number) - (a as number)) // Sort by count descending
      .map(([cat, count]) => `${cat}: ${count} (${((count as number / state.crawlSession.successfulPages) * 100).toFixed(1)}%)`)
      .join('\n    ');
    console.log('  Categories:');
    console.log(`    ${categoryStats}`);
    
    state.lastLogTime = now;
    state.lastLogUrlCount = urlCount;
  }

  // Always call the progress callback if provided
  if (progressCallback) {
    progressCallback({
      processedPages: urlCount,
      totalPages: state.config.maxPages!,
      percentage: (urlCount / state.config.maxPages!) * 100,
      currentUrl,
      activePages: state.activePages
    });
  }
}

async function fetchPageContent(state: CrawlState, url: string): Promise<PageContent | null> {
  await delay(state);

  for (let attempt = 0; attempt < state.config.maxRetries!; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          ...DEFAULT_HEADERS,
          'Accept-Language': 'en-US,en;q=0.9' // Force English content
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        const status = response.status;
        if ([401, 403, 404].includes(status)) {
          console.warn(`Page returned ${status} for ${url}, skipping...`);
          return null;
        }
        if (status === 429) {
          console.warn(`Rate limited for ${url}, waiting longer before retry...`);
          await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1)));
          continue;
        }
        if (status === 503) {
          console.warn(`Service unavailable for ${url}, waiting before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
          continue;
        }
        throw new Error(`HTTP error! status: ${status}`);
      }

      // Check if the response is a PDF
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/pdf')) {
        const arrayBuffer = await response.arrayBuffer();
        return await processPdfContent(url, arrayBuffer, state.config.businessId);
      }

      // Handle HTML content
      const html = await response.text();
      return await processHtmlContent(url, html, state.config.businessId);
    } catch (error) {
      if (attempt === state.config.maxRetries! - 1) {
        const updatedSession = new CrawlSession({
          businessId: state.crawlSession.businessId,
          startTime: state.crawlSession.startTime,
          totalPages: state.visitedUrls.size,
          successfulPages: state.crawlSession.successfulPages,
          failedPages: state.crawlSession.failedPages + 1,
          categories: state.crawlSession.categories,
          errors: [...state.crawlSession.errors, {
            url,
            error: error instanceof Error ? error.message : 'Unknown error'
          }]
        });
        state.crawlSession = updatedSession;
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  return null;
}

async function processBatch(state: CrawlState, urls: string[], progressCallback?: (progress: CrawlProgress) => void): Promise<PageContent[]> {
  const limit = pLimit(state.config.concurrency!);
  const results: PageContent[] = [];

  const batchResults = await Promise.allSettled(
    urls.map(url =>
      limit(async () => {
        if (state.visitedUrls.has(url)) {
          return null;
        }

        state.visitedUrls.add(url);
        state.activePages++;

        // Log progress
        logProgress(state, url, progressCallback);

        try {
          const pageContent = await fetchPageContent(state, url);
          if (!pageContent) {
            // Update crawl session
            const updatedSession = new CrawlSession({
              businessId: state.crawlSession.businessId,
              startTime: state.crawlSession.startTime,
              totalPages: state.visitedUrls.size,
              successfulPages: state.crawlSession.successfulPages,
              failedPages: state.crawlSession.failedPages + 1,
              categories: state.crawlSession.categories,
              errors: state.crawlSession.errors
            });
            state.crawlSession = updatedSession;
            return null;
          }

          if (pageContent.category) {
            const categories = { ...state.crawlSession.categories };
            categories[pageContent.category] = (categories[pageContent.category] || 0) + 1;
            
            // Update crawl session
            const updatedSession = new CrawlSession({
              businessId: state.crawlSession.businessId,
              startTime: state.crawlSession.startTime,
              totalPages: state.visitedUrls.size,
              successfulPages: state.crawlSession.successfulPages + 1,
              failedPages: state.crawlSession.failedPages,
              categories,
              errors: state.crawlSession.errors
            });
            state.crawlSession = updatedSession;
          }

          return pageContent;
        } catch (error) {
          // Update crawl session
          const updatedSession = new CrawlSession({
            businessId: state.crawlSession.businessId,
            startTime: state.crawlSession.startTime,
            totalPages: state.visitedUrls.size,
            successfulPages: state.crawlSession.successfulPages,
            failedPages: state.crawlSession.failedPages + 1,
            categories: state.crawlSession.categories,
            errors: [...state.crawlSession.errors, {
              url,
              error: error instanceof Error ? error.message : 'Unknown error'
            }]
          });
          state.crawlSession = updatedSession;
          return null;
        } finally {
          state.activePages--;
        }
      })
    )
  );

  for (const result of batchResults) {
    if (result.status === 'fulfilled' && result.value) {
      results.push(result.value);
    }
  }

  return results;
}

async function crawlWebsite(state: CrawlState, progressCallback?: (progress: CrawlProgress) => void): Promise<CrawlSession> {
  try {
    const isAllowed = await validateAndCheckRobots(state);
    if (!isAllowed) {
      throw new Error(`Crawling disallowed by robots.txt for ${state.config.websiteUrl}`);
    }

    let urlsToProcess: string[] = [];
    
    // Get initial URLs to start crawling
    if (state.config.useSitemap) {
      urlsToProcess = await getInitialUrls(state);
    }

    // Process URLs in batches
    const results: PageContent[] = [];
    while (urlsToProcess.length > 0 && state.visitedUrls.size < state.config.maxPages!) {
      const batch = urlsToProcess.splice(0, state.config.concurrency!);
      const batchResults = await processBatch(state, batch, progressCallback);
      results.push(...batchResults);

      // Add new links to the queue
      for (const result of batchResults) {
        urlsToProcess.push(...result.links.filter(link => 
          !state.visitedUrls.has(link) &&
          !urlsToProcess.includes(link)
        ));
      }
    }

    // Update crawl session with final stats
    const finalSession = new CrawlSession({
      businessId: state.crawlSession.businessId,
      startTime: state.crawlSession.startTime,
      endTime: Date.now(),
      totalPages: state.visitedUrls.size,
      successfulPages: state.crawlSession.successfulPages,
      failedPages: state.crawlSession.failedPages,
      categories: state.crawlSession.categories,
      errors: state.crawlSession.errors
    });
    state.crawlSession = finalSession;

    // Store crawl session metadata
    await CrawlSession.add(state.crawlSession);

    // Create embeddings synchronously before returning
    await createEmbeddings(results);

    return state.crawlSession;
  } catch (error) {
    // Update crawl session with error
    const errorSession = new CrawlSession({
      businessId: state.crawlSession.businessId,
      startTime: state.crawlSession.startTime,
      endTime: Date.now(),
      totalPages: state.visitedUrls.size,
      successfulPages: state.crawlSession.successfulPages,
      failedPages: state.crawlSession.failedPages,
      categories: state.crawlSession.categories,
      errors: [...state.crawlSession.errors, {
        url: state.config.websiteUrl,
        error: error instanceof Error ? error.message : 'Unknown error'
      }]
    });
    state.crawlSession = errorSession;
    if (error) {
      handleModelError('Failed to insert crawl session', error);
    }
    throw error;
  }
}

export async function setupBusinessAiBot(config: FastCrawlConfig, progressCallback?: (progress: CrawlProgress) => void) {
  const state = createInitialState(config);
  return await crawlWebsite(state, progressCallback);
} 